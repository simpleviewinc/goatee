const tagMatcher = /Ͼ([\?]?)([\$#!:\/\>\+%]?)([%]?)(-*?)([~\*@]?)(\w+(Ԓ\([\s\S]*?Ԓ\))?(\.\w+(Ԓ\([\s\S]*?Ԓ\))?)*?)?Ͽ/g
const termMatcher = /(\w+)(Ԓ\([\s\S]*?Ԓ\))?(\.|$)/g

interface Term {
	label: string
	argString?: string
}

export interface TemplateContext {
	tags: any[]
	start: number
	inner: string
	innerStart: number
	innerEnd: number
	end: number
}

export default function getTemplateContext(html: string) {
	var context: TemplateContext = {
		tags : [],
		start : 0, // the character index that the tag starts at
		inner : html, // the content between the closing and opening tag
		innerStart : 0, // the character index where the content of the inner part of the tag starts
		innerEnd : html.length, // the character index where the content of the inner part of the tag ends
		end : html.length // the character index of the end of the closing tag
	};
	var myContext = context;
	var previousContext: any[] = [];

	while(true) {
		const matches = tagMatcher.exec(html);

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
			var labelArr: Term[] = [];

			while(tagContent !== undefined) {
				var termMatch = termMatcher.exec(tagContent);

				if (termMatch === null) {
					break;
				}

				const term: Term = {
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
