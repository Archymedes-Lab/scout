// Runs Scout's engine (Bun, loopback :7440) and the web app (Next, :3020); Ctrl+C stops both.
const root = new URL("..", import.meta.url).pathname;
const procs = [
  Bun.spawn(["bun", "src/cli.ts", "engine"], { cwd: root, stdout: "inherit", stderr: "inherit" }),
  Bun.spawn(["bun", "run", "dev"], { cwd: `${root}web`, stdout: "inherit", stderr: "inherit" }),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race(procs.map((p) => p.exited));
stop();
