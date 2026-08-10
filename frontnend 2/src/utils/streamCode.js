export async function streamCode(text, setOutput, msPerChar = 6) {
  let output = '';
  for (const ch of text) {
    output += ch;
    setOutput(output);
    await new Promise(r => setTimeout(r, msPerChar));
  }
  return output;
}

export default streamCode;
