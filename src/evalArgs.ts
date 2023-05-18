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
for(var i = 0; i < maskArgs.length; i++) {
	maskedValues.push(undefined);
}

export default function evalArgs(str, data, global, extra, helpers) {
	const fnArgs: [any, ...any[]] = [null];
	fnArgs.push(...maskArgs);
	fnArgs.push("data", "global", "extra", "helpers", "return [" + str + "]");

	try {
		// create a function using our array of arguments and fn string
		var fn = new (Function.prototype.bind.apply(Function, fnArgs));
		// exec the function passing our relevant keys and the masked keys, this generates an array of args
		var temp = fn.apply(null, maskedValues.concat([data, global, extra, helpers]));
	} catch (e) {
		warn(e);
		return e;
	}

	return temp;
}
