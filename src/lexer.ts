import {
	openChar,
	closeChar,
	commentOpen,
	commentClose,
	parenChar
} from "./constants";

const lexerRegex = /(\{\{!--|--\}\}|\{\{|\}\})/g;

function lexerReplace(val: string) {
	return val === "{{" ? openChar : val === "}}" ? closeChar : val === "{{!--" ? commentOpen : commentClose;
}

// lexes the template to detect opening and closing tags and parens
export default function lexer(html: string): string {
	// convert open close to single chars to make algorithm easier
	const temp = html.replace(lexerRegex, lexerReplace);

	let result = "";

	let inTag = false;
	let inParen = false;
	let inSingle = false;
	let inDouble = false;
	let inComment = false;

	let openCount = 0;
	let c;
	let lastC;

	for (let i = 0; i < temp.length; i++) {
		c = temp[i];

		if (inComment && c === commentClose) {
			inComment = false;
			c = "";
		} else if (inComment) {
			c = "";
		} else if (inTag) {
			// inside tag
			if (inParen) {
				if (c === openChar) {
					c = "{{"
				} else if (c === closeChar) {
					c = "}}";
				} else if (inSingle && c === "'") {
					inSingle = false;
				} else if (inSingle) {
					// inside single do nothing
				} else if (inDouble && c === '"') {
					inDouble = false;
				} else if (inDouble) {
					// inside double do nothing
				} else if (c === "(") {
					openCount++;
				} else if (c === ")") {
					openCount--;
					if (openCount === 0) {
						inParen = false;
						c = parenChar + ")";
					}
				} else if (c === '"') {
					inDouble = true;
				} else if (c === "'") {
					inSingle = true;
				}
			} else if (c === "(") {
				// in tag, not in parent, open char
				inParen = true;
				openCount++;
				c = parenChar + "(";
			} else if (c === closeChar) {
				inTag = false;
			}
		} else if (c === commentOpen) {
			inComment = true;
			c = "";
		} else if (c === openChar) {
			// not in tag, open char
			inTag = true;
		} else if (c === closeChar) {
			// not in tag, close char, swap back
			c = "}}";
		}

		lastC = c;
		result += c;
	}

	return result;
}
