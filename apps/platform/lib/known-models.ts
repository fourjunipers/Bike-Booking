/**
 * A first guess at a make and model from a product's name, for the Moto
 * Mangos review form: the only place on the platform that asks for them
 * (owner, 13 Nov 2026). The shop corrects the guess before sending.
 */

/** Lower case, no accents, one space between words. */
function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A name split into its two parts: the first word is the make, the rest is
 * the model ("Royal Enfield Classic" needs a hand, which is why the form
 * shows both parts to check). A make from the Moto Mangos list that the name
 * starts with wins over the first word.
 */
export function splitMakeModel(
  text: string,
  makes: string[] = [],
): { make: string; model: string } {
  const typed = text.replace(/\s+/g, " ").trim();
  if (!typed) return { make: "", model: "" };
  const known = makes
    .filter((make) => plain(typed).startsWith(plain(make) + " "))
    .sort((a, b) => b.length - a.length)[0];
  if (known) return { make: known, model: typed.slice(known.length).trim() };
  const space = typed.indexOf(" ");
  return space === -1
    ? { make: typed, model: "" }
    : { make: typed.slice(0, space), model: typed.slice(space + 1) };
}
