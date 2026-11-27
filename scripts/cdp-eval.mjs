const [, , webSocketUrl, expression] = process.argv;

if (!webSocketUrl || !expression) {
  console.error("Usage: node scripts/cdp-eval.mjs <ws-url> <expression>");
  process.exit(2);
}

const socket = new WebSocket(webSocketUrl);
const timeout = setTimeout(() => {
  console.error("CDP evaluation timed out");
  process.exit(1);
}, 10000);

socket.addEventListener("open", () => {
  socket.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: {
        expression,
        awaitPromise: true,
        returnByValue: true
      }
    })
  );
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id !== 1) return;
  clearTimeout(timeout);
  if (message.error) {
    console.error(JSON.stringify(message.error, null, 2));
    process.exitCode = 1;
  } else {
    const result = message.result?.result;
    if (result?.exceptionDetails) {
      console.error(JSON.stringify(result.exceptionDetails, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result?.value ?? null, null, 2));
    }
  }
  socket.close();
});

socket.addEventListener("error", (event) => {
  clearTimeout(timeout);
  console.error(event);
  process.exit(1);
});
