import warn from "./warn";

// we mask these args with undefined to prevent exec from reaching them
const maskArgs = [
	"window",
	"process",
	"require",
	"setTimeout",
	"setInterval",
	"clearTimeout",
	"clearInterval",
	"__dirname",
	"__filename",
	"module",
	"exports",
	"Buffer",
	"define"
];

const maskedValues: undefined[] = [];
for (let i = 0; i < maskArgs.length; i++) {
	maskedValues.push(undefined);
}

export default function evalArgs(str, data, global, extra, helpers) {
	const fnArgs = [
		...maskArgs,
		"data",
		"global",
		"extra",
		"helpers",
		"return [" + str + "]"
	];

	let temp;
	try {
		// create a function using our array of arguments and fn string
		const fn = new Function(...fnArgs);
		// exec the function passing our relevant keys and the masked keys, this generates an array of args
		temp = fn(...maskedValues, data, global, extra, helpers);
	} catch (e) {
		warn(e);
		return e;
	}

	return temp;
}
