/**
 * Read a line from stdin without echoing it (for secrets). Resolves with the
 * entered text. Rejects if stdin is not a TTY (callers should fall back to flags
 * or environment variables in non-interactive contexts).
 */
export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      reject(new Error('Cannot prompt for input: stdin is not a TTY'));
      return;
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    let input = '';
    const cleanup = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const onData = (chunk: Buffer): void => {
      for (const char of chunk.toString('utf8')) {
        switch (char) {
          case '\n':
          case '\r':
            cleanup();
            stdout.write('\n');
            resolve(input);
            return;
          case '': // Ctrl-C
            cleanup();
            stdout.write('\n');
            reject(new Error('Input cancelled'));
            return;
          case '': // Backspace / Delete
          case '\b':
            input = input.slice(0, -1);
            break;
          default:
            input += char;
        }
      }
    };

    stdin.on('data', onData);
  });
}
