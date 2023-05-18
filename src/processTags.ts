import getTemplateContext, { TemplateContext } from "./getTemplateContext";
import unlex from "./unlex";
import evalArgs from "./evalArgs";
import Helpers from "./Helpers";

function getKeyMatch(obj, key) {
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

function arrayToString(arr) {
	var str = "";
	for(var i = 0; i < arr.length; i++) {
		str += arr[i];
	}

	return str;
}

function isEmpty(obj) {
	return Object.keys(obj).length === 0;
};

export default function processTags(html, context: TemplateContext, data, partials, extraData, globalData, helpers: Helpers) {
	var returnArray: string[] = [];

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
				const argArray = labelArr[j].argString !== ""
					? evalArgs(labelArr[j].argString, dataContext[dataContext.length - 1], globalData, extraData, helpers)
					: undefined;

				if (argArray instanceof Error) {
					// invalid arg array, halt processing of this tag
					myData = undefined;
					break;
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
					returnArray.push(myData.toString())
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
						returnArray.push(helpers.fill(myData.template, myData.data[j], partials, globalData));
					}
				} else {
					returnArray.push(helpers.fill(myData.template, myData.data, partials, globalData));
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
						odd : false,
						data: undefined
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
