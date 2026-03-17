import { spawn } from "child_process";

export function cmdService(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {

    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      if (!options.silent) {
        process.stdout.write(text);
      }
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;

      if (!options.silent) {
        process.stderr.write(text);
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {

      const result = {
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };

      if (code === 0) {
        resolve(result);
      } else {
        const err = new Error(stderr || `Exit code ${code}`);
        err.result = result;
        reject(err);
      }
    });
  });
}