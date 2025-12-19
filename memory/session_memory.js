let session = [];

export function getSessionContext(newInput) {
  session.push(newInput);

  if (session.length > 5) session.shift();

  return session.join(" | ");
}
