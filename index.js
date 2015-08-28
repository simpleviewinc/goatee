// umd boilerplate for CommonJS and AMD
if (typeof exports === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	(function() {
		var openChar = "Ͼ";
		var closeChar = "Ͽ";
		var parenChar = "Ԓ";
		
		// lexes the template to detect opening and closing tags and parens
		var lexer = function(html) {
			// convert open close to single chars to make algorithm easier
			var temp = html.replace(/\{\{/g, openChar).replace(/\}\}/g, closeChar).split("");
			
			var marks = [];
			
			var inTag = false;
			var inParen = false;
			var inSingle = false;
			var inDouble = false;
			
			var openCount = 0;
			
			for(var i = 0; i < temp.length; i++) {
				var c = temp[i];
				
				if (inTag) {
					// inside tag
					if (inParen) {
						if (c === openChar) {
							temp.splice(i, 1, "{{");
						} else if (c === closeChar) {
							temp.splice(i, 1, "}}");
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
								temp.splice(i, 0, parenChar);
								i++;
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
						temp.splice(i, 0, parenChar);
						i++;
					} else if (c === closeChar) {
						inTag = false;
					}
				} else if (c === openChar) {
					// not in tag, open char
					inTag = true;
				}
			}
			
			return temp.join("");
		}
		
		var unlex = function(html) {
			return html.replace(/Ͼ/g, "{{").replace(/Ͽ/g, "}}").replace(/Ԓ/g, "");
		}
		
		var fill = function(html, data, partials, globalData, plugins) {
			if (typeof partials == "undefined") {
				partials = {};
			}
			if (typeof globalData == "undefined") {
				globalData = data;
			}
			if (data === undefined) {
				data = {};
			}
			
			var lexedHtml = lexer(html);
			var context = getTemplateContext(lexedHtml);
			var myPartials = {};
			for(var i in partials) {
				var temp = lexer(partials[i]);
				myPartials[i] = {
					context : getTemplateContext(temp),
					html : temp
				};
			}
			
			var helpers = new Helpers({ partials : myPartials, plugins : plugins || {} });
			
			return processTags(lexedHtml, context, [ data ], myPartials, {}, globalData, helpers);
		};
		
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
				var matches = currentHTML.match(/Ͼ([\?]?)([\$#!:\/\>\+%]?)(-*?)([~\*@]?)(\w+(Ԓ\([\s\S]*?Ԓ\))?(\.\w+(Ԓ\([\s\S]*?Ԓ\))?)*?)?Ͽ/);
				
				if (matches == null) {
					break;
				}
				
				var wholeTag = matches[0];
				var elseTag = matches[1] === "?"; // if this tag is an else tag
				var operator = matches[2];
				var backTrack = matches[3];
				var lookup = matches[4];
				var tagContent = matches[5];
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
					var temp = tagContent;
					while(temp !== undefined) {
						var termMatch = temp.match(/(\w+)(Ԓ\([\s\S]*?Ԓ\))?(\.|$)/);
						
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
						
						temp = temp.replace(termMatch[0], "");
						
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
				
				var temp = [];
				for(var i = 0; i < wholeTag.length; i++) {
					temp.push("-");
				}
				currentHTML = currentHTML.replace(wholeTag, temp.join(""));
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
					if (!(myData instanceof Object)) {
						// if myData is not an Object (includes {} and []) then we can't dive deeper
						// set to undefined because it means we were not able to process all labels
						myData = undefined;
						break;
					}
					
					var keyMatch = getKeyMatch(myData, labelArr[j].label);
					
					if (myData[keyMatch] === undefined) {
						// set to undefined because it means we were not able to process all labels
						myData = undefined;
						break;
					}
					
					if (typeof myData[keyMatch] === "function" && labelArr[j].argString !== undefined) {
						// if it's a function and we have () then we execute it
						var argArray;
						
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
						} else {
							returnArray.push(myData.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
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
						typeof myData != "undefined" &&
						ifElseActivated === false && (
							(typeof myData == "string" && myData != "" && myData != "false")
							|| 
							(myData instanceof Array && myData.length > 0)
							||
							(myData instanceof Date)
							||
							(myData instanceof Object && !isEmpty(myData))
							||
							(typeof myData == "boolean" && myData != false)
							||
							(typeof myData == "number")
						)
					) {
						ifElseActivated = true;
						returnArray.push(processTags(html, context.tags[i], dataContext, partials, extraData, globalData, helpers));
					}
				} else if (context.tags[i].command === "!") {
					if (
						myData instanceof Date === false &&
						ifElseActivated === false && (
							(typeof myData == "undefined")
							||
							(typeof myData == "string" && (myData == "" || myData == "false"))
							||
							(myData instanceof Array && myData.length == 0)
							||
							(myData === null)
							||
							(myData instanceof Object && isEmpty(myData))
							||
							(typeof myData == "boolean" && myData == false)
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
			
			return unlex(returnArray.join(""));
		};
		
		/*** Cross browser way to test if an object has no keys ***/
		var isEmpty = function(obj) {
			for(var prop in obj) {
				if(obj.hasOwnProperty(prop)) {
					return false;
				}
			}
			
			return true;
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
		
		// helpers provide all fill() calls with useful function calls to assist in eliminating pre-processing
		var Helpers = function(args) {
			var self = this;
			
			self.var = {};
			
			self._partials = args.partials;
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
			
			return unlex(self._partials[name].html);
		}
		
		Helpers.prototype.log = function() {
			var self = this;
			
			console.log.apply(console, arguments);
		}
		
		Helpers.prototype.setVar = function(arg1, arg2) {
			var self = this;
			
			self.var[arg1] = arg2;
		}
		
		var Goatee = function() {
			var self = this;
			
			self._plugins = {};
			self._locked = false;
		}
		
		Goatee.prototype.addPlugin = function(name, plugin) {
			var self = this;
			
			if (self._locked) {
				throw new Error("Unable to addPlugin to locked goatee instance as it could cause thread safety issues. If you need to add plugins create your own instance of goatee.Goatee()");
			}
			
			self._plugins[name] = plugin;
		}
		
		Goatee.prototype.fill = function(html, data, partials, globalData, plugins) {
			var self = this;
			
			return fill(html, data || {}, partials || {}, globalData || data, self._plugins);
		};
		
		Goatee.prototype.lock = function() {
			var self = this;
			self._locked = true;
		}
		
		/*** only reveal public methods ***/
		exports.fill = fill;
		exports._lexer = lexer;
		exports._unlex = unlex;
		exports.Goatee = Goatee;
	})();
	
	var warn = function(e) {
		console.warn(e.message, e.stack);
	}
	
	var evalArgs = function(str, data, global, extra, helpers) {
		// we var all important variables to negate closure scope preventing eval from escalating out of the sandbox
		var window, process, require, setTimeout, setInterval, clearTimeout, clearInterval, __dirname, __filename, module, exports, Buffer, define;
		arguments = [];
		
		try {
			var temp = eval("[" + str + "]");
		} catch (e) {
			warn(e);
			return e;
		}
		
		return temp;
	}
});
