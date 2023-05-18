import lexer from "./lexer";
import getTemplateContext from "./getTemplateContext";
import Helpers from "./Helpers";
import processTags from "./processTags";

class Goatee {
	_cache: any
	_plugins: any
	_locked: boolean
	_templateCache: object
	constructor({ cache = false } = {}) {
		this._cache = cache;
		this._plugins = {};
		this._locked = false;
		this._templateCache = {};
	}
	addPlugin(name, plugin) {
		const self = this;

		if (self._locked) {
			throw new Error("Unable to addPlugin to locked goatee instance as it could cause thread safety issues. If you need to add plugins create your own instance of goatee.Goatee()");
		}

		self._plugins[name] = plugin;
	}
	fill(html: string, data: object = {}, partials?, globalData?) {
		const self = this;

		if (typeof partials == "undefined") {
			partials = {};
		}
		if (typeof globalData == "undefined") {
			globalData = data;
		}
		if (data === undefined) {
			data = {};
		}

		const template = self._processTemplate(html);
		const myPartials = {};
		for (const i in partials) {
			myPartials[i] = self._processTemplate(partials[i]);
		}

		const helpers = new Helpers({ partials: myPartials, plugins: self._plugins || {}, goatee: self });

		const result = processTags(template.html, template.context, [ data ], myPartials, {}, globalData, helpers);

		return result;
	}
	_processTemplate(html: string) {
		const self = this;

		const cached = self._templateCache[html];

		if (self._cache === true && cached !== undefined) {
			cached.hitCount++;
			return cached;
		}

		const lexedHtml = lexer(html);
		const context = getTemplateContext(lexedHtml);

		const temp = {
			hitCount: 0,
			raw: html,
			html: lexedHtml,
			context: context
		}

		if (self._cache === true) {
			self._templateCache[html] = temp;
		}

		return temp;
	}
	clearTemplateCache() {
		const self = this;

		self._templateCache = {};
	}
	lock() {
		const self = this;
		self._locked = true;
	}
}

export default Goatee;
