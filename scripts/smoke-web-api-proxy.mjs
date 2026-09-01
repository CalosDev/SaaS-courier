import { spawnSync } from "node:child_process";
import http from "node:http";

const projectName = "courier-proxy-smoke";
const composeArgs = [
  "compose",
  "--project-name",
  projectName,
  "--file",
  "compose.proxy-smoke.yml",
];
const expectedHost = "courier-smoke.example.test";

function runDocker(args, options = {}) {
  const result = spawnSync("docker", [...composeArgs, ...args], {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(" ")} failed`);
  }
}

function cleanupDocker() {
  spawnSync(
    "docker",
    [...composeArgs, "down", "--volumes", "--remove-orphans"],
    { stdio: "inherit", shell: false },
  );
}

function requestProbe() {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: 3100,
        path: "/backend/health/live?smoke=1",
        method: "GET",
        headers: { Host: expectedHost },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`proxy returned HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

const dockerCheck = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
  stdio: "ignore",
  shell: false,
});
if (dockerCheck.error || dockerCheck.status !== 0) {
  throw new Error("Docker Desktop must be running for the proxy smoke test");
}

try {
  runDocker(["up", "--build", "--detach", "--wait"]);
  const result = await requestProbe();
  if (result.forwardedHost !== expectedHost) {
    throw new Error(
      `tenant host was not preserved: expected ${expectedHost}, received ${result.forwardedHost}`,
    );
  }
  if (result.url !== "/health/live?smoke=1") {
    throw new Error(`unexpected upstream path: ${result.url}`);
  }
  if (result.forwardedProto !== "http") {
    throw new Error(`unexpected forwarded protocol: ${result.forwardedProto}`);
  }
  process.stdout.write("Web-to-API proxy smoke test passed.\n");
} finally {
  cleanupDocker();
}
