import warn from "./warn";
import Goatee from "./Goatee";

// helpers provide all fill() calls with useful function calls to assist in eliminating pre-processing
class Helpers {
	_partials: any
	_goatee: Goatee
	plugins: any
	var: object
	constructor(args) {
		this.var = {};
		this._partials = args.partials;
		this._goatee = args.goatee;
		this.plugins = args.plugins;
	}
	equal(arg1, arg2) {
		return arg1 === arg2;
	}
	contains(arg1, arg2) {
		if (arg1.indexOf === undefined) {
			return false;
		}

		return arg1.indexOf(arg2) > -1;
	}
	exec(arg1) {
		if (arg1 instanceof Function) {
			// if it's a function we have to wrap in another try catch to prevent failures
			try {
				var temp = arg1();
			} catch (e) {
				warn(e);
				return; // return undefined if exec fails
			}
		} else {
			// if it's not a function simply return the result
			temp = arg1;
		}

		return temp;
	}
	partial(name) {
		const self = this;

		return self._partials[name].raw;
	}
	log(...args: Parameters<Console["log"]>) {
		console.log.apply(console, args);
	}
	setVar(arg1, arg2) {
		const self = this;

		self.var[arg1] = arg2;
	}
	fill(...args: Parameters<Goatee["fill"]>) {
		const self = this;

		return self._goatee.fill.apply(self._goatee, args);
	}
	stringify(arg1, arg2, arg3) {
		return JSON.stringify(arg1, arg2, arg3);
	}
}

export default Helpers;
