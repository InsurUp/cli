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

/**
 * Ask the user to pick one of `choices` (echoing input). Accepts the 1-based
 * index or the option value/label; resolves `opts.default` on an empty line, EOF,
 * or when stdin is not a TTY — so non-interactive callers (pipes, CI) fall back to
 * the default rather than hang.
 */
export function select<T extends string>(
  question: string,
  choices: readonly { readonly value: T; readonly label: string }[],
  opts: { default: T },
): Promise<T> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      resolve(opts.default);
      return;
    }

    stdout.write(`${question}\n`);
    choices.forEach((choice, i) => {
      const suffix = choice.value === opts.default ? ' (default)' : '';
      stdout.write(`  ${String(i + 1)}) ${choice.label}${suffix}\n`);
    });
    stdout.write('> ');
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = (): void => {
      stdin.pause();
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
    };
    const onData = (chunk: string): void => {
      cleanup();
      const answer = chunk.trim().toLowerCase();
      if (answer === '') {
        resolve(opts.default);
        return;
      }
      const index = Number.parseInt(answer, 10);
      const byIndex = index >= 1 && index <= choices.length ? choices[index - 1] : undefined;
      const byValue = choices.find((c) => c.value === answer || c.label.toLowerCase() === answer);
      resolve((byIndex ?? byValue)?.value ?? opts.default);
    };
    const onEnd = (): void => {
      cleanup();
      resolve(opts.default);
    };

    stdin.on('data', onData);
    stdin.on('end', onEnd);
  });
}

/**
 * Ask for a line of text on stdin (echoing input). Resolves `opts.default` on an
 * empty line, EOF, or when stdin is not a TTY — so non-interactive callers fall
 * back to the default rather than hang.
 */
export function promptText(question: string, opts: { default?: string } = {}): Promise<string> {
  const fallback = opts.default ?? '';
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      resolve(fallback);
      return;
    }

    stdout.write(opts.default ? `${question} [${opts.default}] ` : `${question} `);
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = (): void => {
      stdin.pause();
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
    };
    const onData = (chunk: string): void => {
      cleanup();
      const answer = chunk.trim();
      resolve(answer === '' ? fallback : answer);
    };
    const onEnd = (): void => {
      cleanup();
      resolve(fallback);
    };

    stdin.on('data', onData);
    stdin.on('end', onEnd);
  });
}

/**
 * Ask a yes/no question on stdin (echoing input). Resolves the default on an
 * empty line or EOF, and resolves `false` immediately when stdin is not a TTY
 * so non-interactive callers (pipes, CI) simply stop rather than hang.
 */
export function confirm(question: string, opts: { default?: boolean } = {}): Promise<boolean> {
  const fallback = opts.default ?? true;
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      resolve(false);
      return;
    }

    stdout.write(`${question} [${fallback ? 'Y/n' : 'y/N'}] `);
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = (): void => {
      stdin.pause();
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
    };
    const onData = (chunk: string): void => {
      cleanup();
      const answer = chunk.trim().toLowerCase();
      resolve(answer === '' ? fallback : answer === 'y' || answer === 'yes');
    };
    const onEnd = (): void => {
      cleanup();
      resolve(fallback);
    };

    stdin.on('data', onData);
    stdin.on('end', onEnd);
  });
}
