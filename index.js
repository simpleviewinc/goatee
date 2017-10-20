"use strict";

// umd boilerplate for CommonJS and AMD
if (typeof exports === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	(function() {
		var commentOpen = "ᾷ";
		var commentClose = "ἔ";
		var openChar = "Ͼ";
		var closeChar = "Ͽ";
		var parenChar = "Ԓ";
		
		var tagMatcher = /Ͼ([\?]?)([\$#!:\/\>\+%]?)([%]?)(-*?)([~\*@]?)(\w+(Ԓ\([\s\S]*?Ԓ\))?(\.\w+(Ԓ\([\s\S]*?Ԓ\))?)*?)?Ͽ/g
		var termMatcher = /(\w+)(Ԓ\([\s\S]*?Ԓ\))?(\.|$)/g
		
		var lexerRegex = /(\{\{!--|--\}\}|\{\{|\}\})/g;
		var lexerReplace = function(val, i) {
			return val === "{{" ? openChar : val === "}}" ? closeChar : val === "{{!--" ? commentOpen : commentClose;
		}
		
		// lexes the template to detect opening and closing tags and parens
		var lexer = function(html) {
			// convert open close to single chars to make algorithm easier
			var temp = html.replace(lexerRegex, lexerReplace);
			
			var result = "";
			
			var inTag = false;
			var inParen = false;
			var inSingle = false;
			var inDouble = false;
			var inComment = false;
			
			var openCount = 0;
			var c;
			var lastC;
			
			for(var i = 0; i < temp.length; i++) {
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
		
		var unlexRegex = /[ϾϿԒ]/g;
		var unlexReplace = function(val, i) {
			return val === openChar ? "{{" : val === closeChar ? "}}" : ""
		};
		var unlex = function(html) {
			return html.replace(unlexRegex, unlexReplace);
		}
		
		var getTemplateContext = function(html) {
			var currentHTML = html;
			
			var context = {
				tags : [],
				start : 0, // the character index that the tag starts at
				inner : html, // the content between the closing and opening tag
				innerStart : 0, // the character index where the content of the inner part of the tag starts
				innerEnd : html.length, // the character index where the content of the inner part of the tag ends
				end : html.length // the character index of the end of the closing tag
			};
			var myContext = context;
			var previousContext = [];
			
			while(true) {
				var matches = tagMatcher.exec(html);
				
				if (matches == null) {
					break;
				}
				
				var wholeTag = matches[0];
				var elseTag = matches[1] === "?"; // if this tag is an else tag
				var operator = matches[2];
				var modifier = matches[3];
				var backTrack = matches[4];
				var lookup = matches[5];
				var tagContent = matches[6];
				var ifStarterTag = [":", "!"].indexOf(operator) > -1; // if this tag is the opening of an if/else block
				var ifElseTag = elseTag || ifStarterTag;
				
				var exitContext = function() {
					myContext.end = wholeTag.length + matches.index;
					myContext.innerEnd = matches.index;
					myContext.inner = html.substring(myContext.innerStart, myContext.innerEnd);
					myContext = previousContext[previousContext.length - 1];
					previousContext.splice(previousContext.length - 1, 1);
				}
				
				if (elseTag === true) {
					// if we hit an else tag we need to treat it as if it was an end tag to close the previous context
					exitContext();
				}
				
				if (operator != "/") {
					var labelArr = [];
					
					while(tagContent !== undefined) {
						var termMatch = termMatcher.exec(tagContent);
						
						if (termMatch === null) {
							break;
						}
						
						var term = {
							label : termMatch[1]
						};
						
						if (termMatch[2] !== undefined) {
							// extract the contents of a function call eg: foo(bar, baz)
							term.argString = termMatch[2].replace(/^Ԓ\(/, "").replace(/Ԓ\)$/, "");
						}
						
						labelArr.push(term);
					}
					
					myContext.tags.push({
						label : tagContent,
						labelArr : labelArr,
						elseTag : elseTag,
						ifElseTag : ifElseTag,
						ifStarterTag : ifStarterTag,
						backTrack : backTrack.length,
						lookup : lookup,
						command : operator,
						modifier : modifier,
						start : matches.index,
						end : wholeTag.length + matches.index,
						innerStart : wholeTag.length + matches.index,
						innerEnd : undefined,
						tags : []
					});
					
					// if we have an operator which needs a new context, step inside
					if (["#", ":", "!", "+", "$"].indexOf(operator) > -1 || elseTag === true) {
						previousContext.push(myContext);
						myContext = myContext.tags[myContext.tags.length - 1];
					}
				} else {
					exitContext();
				}
			}
			
			return context;
		}
		
		var processTags = function(html, context, data, partials, extraData, globalData, helpers) {
			var returnArray = [];
			
			// keeps track of whether we're in an if/else block and a block previous to this passed it's condition
			var ifElseActivated = false;
			
			var position = context.innerStart;
			for(var i = 0; i < context.tags.length; i++) {
				if (context.tags[i].elseTag === false) {
					ifElseActivated = false;
				}
				
				if (position < context.tags[i].start) {
					returnArray.push(html.substring(position, context.tags[i].start));
				}
				position = context.tags[i].end;
				
				if (context.tags[i].command === ">") {
					var keyMatch = getKeyMatch(partials, context.tags[i].label);
					if (keyMatch !== undefined) {
						returnArray.push(processTags(partials[keyMatch].html, partials[keyMatch].context, data, partials, extraData, globalData, helpers));
					}
					
					continue;
				}
				
				if (context.tags[i].command === "$") {
					returnArray.push(unlex(context.tags[i].inner));
					continue;
				}
				
				var myData;
				var dataContext = data;
				if (context.tags[i].lookup === "*") {
					myData = globalData;
				} else if (context.tags[i].lookup === "@") {
					myData = extraData;
				} else if (context.tags[i].lookup === "~") {
					myData = helpers;
				} else {
					dataContext = data.slice();
					dataContext.splice(dataContext.length - context.tags[i].backTrack, context.tags[i].backTrack);
					
					myData = dataContext[dataContext.length - 1];
				}
				
				var labelArr = context.tags[i].labelArr;
				for(var j = 0; j < labelArr.length; j++) {
					if (myData === undefined || myData === null){
						break;
					}
					
					var keyMatch = getKeyMatch(myData, labelArr[j].label);
					
					if (keyMatch === undefined) {
						// key didn't match hop out
						myData = undefined;
						break;
					}
					
					if (myData[keyMatch] === undefined) {
						// set to undefined because it means we were not able to process all labels
						myData = undefined;
						break;
					}
					
					if (typeof myData[keyMatch] === "function" && labelArr[j].argString !== undefined) {
						// if it's a function and we have () then we execute it
						var argArray = undefined;
						
						if (labelArr[j].argString !== "") {
							// in () argString === "", don't eval arguments in that case
							argArray = evalArgs(labelArr[j].argString, dataContext[dataContext.length - 1], globalData, extraData, helpers);
							if (argArray instanceof Error) {
								// invalid arg array, halt processing of this tag
								myData = undefined;
								break;
							}
						}
						
						myData = myData[keyMatch].apply(myData, argArray);
					} else {
						myData = myData[keyMatch];
					}
				}
				
				var typeofMyData = typeof myData;
				
				if (context.tags[i].command === "" || context.tags[i].command === "%") {
					if (context.tags[i].elseTag === true && ifElseActivated === false) {
						ifElseActivated = true;
						returnArray.push(processTags(html, context.tags[i], dataContext, partials, extraData, globalData, helpers));
					} else if (typeof myData == "undefined" || myData == null) {
						// do nothing
					} else if (typeof myData === "string" || typeof myData === "number" || typeof myData === "boolean") {
						/*** standard tags ***/
						if (context.tags[i].command === "" || typeof myData !== "string") {
							returnArray.push(myData)
						} else if (context.tags[i].modifier === "") {
							returnArray.push(myData.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'));
						} else {
							returnArray.push(encodeURIComponent(myData).replace(/'/g, "%27"));
						}
					} else if (typeof myData.template != "undefined" && typeof myData.data != "undefined") {
						/*** passing a template and data structure ***/
						
						/*** Is array loop over array ***/
						if (myData.data instanceof Array) {
							for(var j = 0; j < myData.data.length; j++) {
								returnArray.push(fill(myData.template, myData.data[j]));
							}
						} else {
							returnArray.push(fill(myData.template, myData.data));
						}
					}
				} else if (context.tags[i].command === "+") {
					partials[context.tags[i].label] = {
						html : context.tags[i].inner,
						raw : unlex(context.tags[i].inner),
						context : getTemplateContext(context.tags[i].inner)
					}
				} else if (context.tags[i].command === "#") {
					if (typeof myData != "undefined") {
						if (myData instanceof Array) {
							var tempExtraData = {
								row : 0,
								first : false,
								last : false,
								even : false,
								odd : false
							};
							for(var j = 0; j < myData.length; j++) {
								tempExtraData.row++;
								tempExtraData.first = tempExtraData.row == 1 ? true : false;
								tempExtraData.last = tempExtraData.row == myData.length ? true : false;
								tempExtraData.odd = tempExtraData.row % 2 == 1 ? true : false;
								tempExtraData.even = !tempExtraData.odd;
								tempExtraData.data = myData[j];
								var newData = dataContext.slice();
								newData.push(myData[j]);
								returnArray.push(processTags(html, context.tags[i], newData, partials, tempExtraData, globalData, helpers));
							}
						} else if (myData instanceof Object && !isEmpty(myData)) {
							var newData = dataContext.slice();
							newData.push(myData);
							returnArray.push(processTags(html, context.tags[i], newData, partials, {}, globalData, helpers));
						}
					}
				} else if (context.tags[i].command === ":") {
					if (
						typeofMyData !== "undefined" &&
						ifElseActivated === false && (
							(typeofMyData === "string" && myData !== "" && myData !== "false")
							|| 
							(myData instanceof Array && myData.length > 0)
							||
							(myData instanceof Date)
							||
							(myData instanceof Object && !isEmpty(myData))
							||
							(typeofMyData === "boolean" && myData !== false)
							||
							(typeofMyData === "number" && myData !== 0 && isNaN(myData) === false)
						)
					) {
						ifElseActivated = true;
						returnArray.push(processTags(html, context.tags[i], dataContext, partials, extraData, globalData, helpers));
					}
				} else if (context.tags[i].command === "!") {
					if (
						myData instanceof Date === false &&
						ifElseActivated === false && (
							(typeofMyData === "undefined")
							||
							(typeofMyData === "string" && (myData === "" || myData === "false"))
							||
							(myData instanceof Array && myData.length == 0)
							||
							(myData === null)
							||
							(myData instanceof Object && isEmpty(myData))
							||
							(typeofMyData === "boolean" && myData === false)
							||
							(typeofMyData === "number" && (myData === 0 || isNaN(myData) === true))
						)
					) {
						ifElseActivated = true;
						returnArray.push(processTags(html, context.tags[i], dataContext, partials, extraData, globalData, helpers));
					}
				}
			}
			
			if (position < context.end) {
				returnArray.push(html.substring(position, context.innerEnd));
			}
			
			var result = arrayToString(returnArray);
			
			return result;
		};
		
		/*** Cross browser way to test if an object has no keys ***/
		var isEmpty = function(obj) {
			return Object.keys(obj).length === 0;
		};
		
		var getKeyMatch = function(obj, key) {
			if (obj[key] !== undefined) {
				return key;
			}
			
			var lcaseKey = key.toLowerCase();
			var map = {};
			
			for(var prop in obj) {
				var temp = prop.toLowerCase();
				if (temp === lcaseKey) {
					return prop;
				}
			}
			
			// key not found
			return undefined;
		}
		
		var arrayToString = function(arr) {
			var str = "";
			for(var i = 0; i < arr.length; i++) {
				str += arr[i];
			}
			
			return str;
		}
		
		// helpers provide all fill() calls with useful function calls to assist in eliminating pre-processing
		var Helpers = function(args) {
			var self = this;
			
			self.var = {};
			
			self._partials = args.partials;
			self._goatee = args.goatee;
			self.plugins = args.plugins;
		}
		
		Helpers.prototype.equal = function(arg1, arg2) {
			return arg1 === arg2;
		}
		
		Helpers.prototype.contains = function(arg1, arg2) {
			if (arg1.indexOf === undefined) {
				return false;
			}
			
			return arg1.indexOf(arg2) > -1;
		}
		
		Helpers.prototype.exec = function(arg1) {
			if (arg1 instanceof Function) {
				// if it's a function we have to wrap in another try catch to prevent failures
				try {
					var temp = arg1();
				} catch(e) {
					warn(e);
					return; // return undefined if exec fails
				}
			} else {
				// if it's not a function simply return the result
				temp = arg1;
			}
			
			return temp;
		}
		
		Helpers.prototype.partial = function(name) {
			var self = this;
			
			return self._partials[name].raw;
		}
		
		Helpers.prototype.log = function() {
			var self = this;
			
			console.log.apply(console, arguments);
		}
		
		Helpers.prototype.setVar = function(arg1, arg2) {
			var self = this;
			
			self.var[arg1] = arg2;
		}
		
		Helpers.prototype.fill = function() {
			var self = this;
			
			return self._goatee.fill.apply(self._goatee, arguments);
		}
		
		Helpers.prototype.stringify = function(arg1, arg2, arg3) {
			return JSON.stringify(arg1, arg2, arg3);
		}
		
		var Goatee = function(args) {
			var self = this;
			
			args = args || {};
			
			self._cache = args.cache === undefined ? false : args.cache;
			self._plugins = {};
			self._locked = false;
			self._templateCache = {};
		}
		
		Goatee.prototype.addPlugin = function(name, plugin) {
			var self = this;
			
			if (self._locked) {
				throw new Error("Unable to addPlugin to locked goatee instance as it could cause thread safety issues. If you need to add plugins create your own instance of goatee.Goatee()");
			}
			
			self._plugins[name] = plugin;
		}
		
		Goatee.prototype.fill = function(html, data, partials, globalData) {
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
			
			var result = processTags(template.html, template.context, [ data ], myPartials, {}, globalData, helpers, self._plugins);
			
			return result;
		};
		
		Goatee.prototype._processTemplate = function(html) {
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
		
		Goatee.prototype.clearTemplateCache = function() {
			var self = this;
			
			self._templateCache = {};
		}
		
		Goatee.prototype.lock = function() {
			var self = this;
			self._locked = true;
		}
		
		/*** only reveal public methods ***/
		var staticGoatee = new Goatee();
		exports.fill = staticGoatee.fill.bind(staticGoatee);
		exports._lexer = lexer;
		exports._getTemplateContext = getTemplateContext;
		exports._unlex = unlex;
		exports.Goatee = Goatee;
	})();
	
	var warn = function(e) {
		console.warn(e.message, e.stack);
	}
	
	// we mask these args with undefined to prevent exec from reaching them
	var maskArgs = [
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
	
	var maskedValues = [];
	for(var i = 0; i < maskArgs.length; i++) {
		maskedValues.push(undefined);
	}
	
	var evalArgs = function(str, data, global, extra, helpers) {
		var fnArgs = [null].concat(maskArgs).concat(["data", "global", "extra", "helpers", "return [" + str + "]"]);
		
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
});
