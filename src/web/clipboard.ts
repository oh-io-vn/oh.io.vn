export async function copyText(
  value: string,
  write: (value: string) => Promise<void> = (text) =>
    navigator.clipboard.writeText(text),
  timeout = 3000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      write(value),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Clipboard unavailable")),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
