// Asks the browser for the microphone at the moment of a tap (Feature 013). The permission prompt then comes from a
// real user action, and a "blocked" answer can be told apart from "no microphone". The stream is stopped at once:
// nothing is recorded, stored or sent. The words themselves are heard by the browser's own speech recognition.

export type MicResult = "granted" | "denied" | "unavailable" | "unsupported";

export async function primeMicrophone(): Promise<MicResult> {
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!devices?.getUserMedia) return "unsupported";
  try {
    const stream = await devices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    // NotAllowedError: blocked by the site setting, the browser or Windows privacy. NotFound / NotReadable: no
    // microphone, or another app is holding it.
    return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable";
  }
}
