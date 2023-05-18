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
		var self = this;

		if (self._locked) {
			throw new Error("Unable to addPlugin to locked goatee instance as it could cause thread safety issues. If you need to add plugins create your own instance of goatee.Goatee()");
		}

		self._plugins[name] = plugin;
	}
	fill(html: string, data: object = {}, partials?, globalData?) {
		var self = this;

		if (typeof partials == "undefined") {
			partials = {};
		}
		if (typeof globalData == "undefined") {
			globalData = data;
		}
		if (data === undefined) {
			data = {};
		}

		var template = self._processTemplate(html);
		var myPartials = {};
		for(var i in partials) {
			myPartials[i] = self._processTemplate(partials[i]);
		}

		var helpers = new Helpers({ partials : myPartials, plugins : self._plugins || {}, goatee : self });

		var result = processTags(template.html, template.context, [ data ], myPartials, {}, globalData, helpers);

		return result;
	}
	_processTemplate(html: string) {
		var self = this;

		var cached = self._templateCache[html];

		if (self._cache === true && cached !== undefined) {
			cached.hitCount++;
			return cached;
		}

		var lexedHtml = lexer(html);
		var context = getTemplateContext(lexedHtml);

		var temp = {
			hitCount : 0,
			raw : html,
			html : lexedHtml,
			context : context
		}

		if (self._cache === true) {
			self._templateCache[html] = temp;
		}

		return temp;
	}
	clearTemplateCache() {
		var self = this;

		self._templateCache = {};
	}
	lock() {
		var self = this;
		self._locked = true;
	}
}

export default Goatee;
