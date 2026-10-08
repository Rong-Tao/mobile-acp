package expo.modules.sshtransport

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.JSch
import com.jcraft.jsch.KeyPair
import com.jcraft.jsch.Session
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import org.bouncycastle.crypto.generators.Ed25519KeyPairGenerator
import org.bouncycastle.crypto.params.Ed25519KeyGenerationParameters
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.util.OpenSSHPrivateKeyUtil
import org.bouncycastle.crypto.util.OpenSSHPublicKeyUtil

private data class SpawnState(
    val channel: ChannelExec,
    val stdin: OutputStream,
    val job: Job,
)

class SshTransportModule : Module() {
    companion object {
        init {
            // JSch picks JDK-native EdDSA/XDH when it detects Java >= 15, but on
            // Android those jce classes are multi-release stubs (D8 drops
            // META-INF/versions) that throw UnsupportedOperationException.
            // Pin the BouncyCastle implementations unconditionally.
            JSch.setConfig("xdh", "com.jcraft.jsch.bc.XDH")
            JSch.setConfig("keypairgen.eddsa", "com.jcraft.jsch.bc.KeyPairGenEdDSA")
            JSch.setConfig("ssh-ed25519", "com.jcraft.jsch.bc.SignatureEd25519")
            JSch.setConfig("ssh-ed448", "com.jcraft.jsch.bc.SignatureEd448")
        }
    }

    private val sessions = ConcurrentHashMap<String, Session>()
    private val spawns = ConcurrentHashMap<String, SpawnState>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun definition() = ModuleDefinition {
        Name("SshTransport")
        Events("onData", "onStderr", "onExit")

        // ── connect with password ──────────────────────────────────
        AsyncFunction("connectPassword") { sessionId: String, host: String, port: Int,
                                           user: String, password: String ->
            val jsch = JSch()
            val session = jsch.getSession(user, host, port)
            session.setPassword(password)
            session.setConfig("StrictHostKeyChecking", "no")
            session.connect(15_000)
            sessions[sessionId] = session
        }

        // ── connect with PEM private key ───────────────────────────
        AsyncFunction("connectKey") { sessionId: String, host: String, port: Int,
                                      user: String, privateKey: String, passphrase: String? ->
            val jsch = JSch()
            jsch.addIdentity(
                "key-$sessionId",
                privateKey.toByteArray(Charsets.UTF_8),
                null,
                passphrase?.toByteArray(Charsets.UTF_8),
            )
            val session = jsch.getSession(user, host, port)
            session.setConfig("StrictHostKeyChecking", "no")
            session.connect(15_000)
            sessions[sessionId] = session
        }

        // ── one-shot exec ──────────────────────────────────────────
        AsyncFunction("exec") { sessionId: String, cmd: String, cwd: String? ->
            val session = sessions[sessionId] ?: throw IllegalStateException("no session: $sessionId")
            val fullCmd = if (cwd != null) "cd ${sq(cwd)} && $cmd" else cmd

            val channel = session.openChannel("exec") as ChannelExec
            channel.setCommand(fullCmd)
            channel.connect()

            val stdout = ByteArrayOutputStream()
            val stderr = ByteArrayOutputStream()
            val buf = ByteArray(8192)

            // Read stderr concurrently in a background thread
            val stderrThread = Thread {
                try {
                    val s = channel.errStream
                    var n: Int
                    while (s.read(buf).also { n = it } != -1) stderr.write(buf, 0, n)
                } catch (_: Exception) {}
            }
            stderrThread.start()

            // Read stdout in current thread (AsyncFunction runs on background thread)
            try {
                val s = channel.inputStream
                var n: Int
                while (s.read(buf).also { n = it } != -1) stdout.write(buf, 0, n)
            } catch (_: Exception) {}

            stderrThread.join()
            val exitCode = channel.exitStatus.takeIf { it >= 0 } ?: 0
            channel.disconnect()

            mapOf(
                "stdout" to stdout.toString("UTF-8"),
                "stderr" to stderr.toString("UTF-8"),
                "code" to exitCode,
            )
        }

        // ── spawn long-lived process ───────────────────────────────
        // Returns immediately; streams data via onData / onStderr / onExit events.
        AsyncFunction("spawn") { sessionId: String, channelId: String, cmd: String, cwd: String? ->
            val session = sessions[sessionId] ?: throw IllegalStateException("no session: $sessionId")
            val fullCmd = if (cwd != null) "cd ${sq(cwd)} && exec $cmd" else "exec $cmd"

            val channel = session.openChannel("exec") as ChannelExec
            channel.setCommand(fullCmd)
            channel.connect()

            val stdin = channel.outputStream

            val job = scope.launch {
                val stdoutJob = launch {
                    val buf = ByteArray(4096)
                    val s = channel.inputStream
                    try {
                        var n: Int
                        while (s.read(buf).also { n = it } != -1) {
                            sendEvent("onData", mapOf(
                                "channelId" to channelId,
                                "data" to String(buf, 0, n, Charsets.UTF_8),
                            ))
                        }
                    } catch (_: Exception) {}
                }
                val stderrJob = launch {
                    val buf = ByteArray(4096)
                    val s = channel.errStream
                    try {
                        var n: Int
                        while (s.read(buf).also { n = it } != -1) {
                            sendEvent("onStderr", mapOf(
                                "channelId" to channelId,
                                "data" to String(buf, 0, n, Charsets.UTF_8),
                            ))
                        }
                    } catch (_: Exception) {}
                }
                stdoutJob.join()
                stderrJob.join()
                spawns.remove(channelId)
                sendEvent("onExit", mapOf(
                    "channelId" to channelId,
                    "code" to (channel.exitStatus.takeIf { it >= 0 } ?: -1),
                ))
            }

            spawns[channelId] = SpawnState(channel, stdin, job)
        }

        // ── write to stdin of spawned process ──────────────────────
        Function("writeStdin") { channelId: String, data: String ->
            val state = spawns[channelId] ?: return@Function
            try {
                state.stdin.write(data.toByteArray(Charsets.UTF_8))
                state.stdin.flush()
            } catch (_: Exception) {}
        }

        // ── kill spawned process ───────────────────────────────────
        Function("killChannel") { channelId: String ->
            val state = spawns.remove(channelId) ?: return@Function
            state.job.cancel()
            try { state.channel.disconnect() } catch (_: Exception) {}
        }

        // ── disconnect SSH session ────────────────────────────────
        Function("disconnect") { sessionId: String ->
            sessions.remove(sessionId)?.let {
                try { it.disconnect() } catch (_: Exception) {}
            }
        }

        Function("isConnected") { sessionId: String ->
            sessions[sessionId]?.isConnected ?: false
        }

        // ── generate Ed25519 keypair ───────────────────────────────
        // Returns { privateKey: PEM string, publicKey: OpenSSH authorized_keys line }
        // Generated with BouncyCastle directly: JSch can generate Ed25519 keys
        // but KeyPairEdDSA.getPrivateKey() throws UnsupportedOperationException,
        // so it cannot write them out. BC encodes the openssh-key-v1 format,
        // which jsch.addIdentity() reads fine.
        AsyncFunction("generateKeyPair") {
            try {
                val gen = Ed25519KeyPairGenerator()
                gen.init(Ed25519KeyGenerationParameters(SecureRandom()))
                val kp = gen.generateKeyPair()
                val priv = kp.private as Ed25519PrivateKeyParameters
                val pub = kp.public as Ed25519PublicKeyParameters

                val privBlob = OpenSSHPrivateKeyUtil.encodePrivateKey(priv)
                val pem = buildString {
                    append("-----BEGIN OPENSSH PRIVATE KEY-----\n")
                    val b64 = android.util.Base64.encodeToString(privBlob, android.util.Base64.NO_WRAP)
                    var i = 0
                    while (i < b64.length) {
                        append(b64, i, minOf(i + 70, b64.length))
                        append('\n')
                        i += 70
                    }
                    append("-----END OPENSSH PRIVATE KEY-----\n")
                }

                val pubBlob = OpenSSHPublicKeyUtil.encodePublicKey(pub)
                val pubLine = "ssh-ed25519 " +
                    android.util.Base64.encodeToString(pubBlob, android.util.Base64.NO_WRAP) + " mobile-acp"

                mapOf(
                    "privateKey" to pem,
                    "publicKey" to pubLine,
                )
            } catch (t: Throwable) {
                // surface the full chain — Expo only shows the top-level message
                throw RuntimeException(
                    "generateKeyPair failed: ${t.stackTraceToString().take(2000)}", t)
            }
        }

        OnDestroy {
            scope.cancel()
            spawns.values.forEach { try { it.channel.disconnect() } catch (_: Exception) {} }
            sessions.values.forEach { try { it.disconnect() } catch (_: Exception) {} }
            spawns.clear()
            sessions.clear()
        }
    }

    // shell-quote a single path component
    private fun sq(s: String) = "'${s.replace("'", "'\\''")}'"
}
