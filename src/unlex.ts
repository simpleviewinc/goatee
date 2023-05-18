import {
	openChar,
	closeChar
} from "./constants";

const unlexRegex = /[ϾϿԒ]/g;
const unlexReplace = function(val, i) {
	return val === openChar ? "{{" : val === closeChar ? "}}" : ""
};

export default function unlex(html: string): string {
	return html.replace(unlexRegex, unlexReplace);
}
