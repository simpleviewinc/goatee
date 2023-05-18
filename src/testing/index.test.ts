import assert from "assert";
import { execSync } from "child_process";

import { fill, Goatee } from "../index";
import lexer from "../lexer";
import unlex from "../unlex";

describe(__filename, function() {
	// used to monkey patch console.log, console.warn in order to ensure that certain logging statements are working as intended
	class Monkey {
		type: string
		messages: any[][]
		old: any
		constructor(type) {
			this.type = type;
			this.messages = [];
			this.old = console[type];

			console[type] = this.process.bind(this);
		}
		process(...args) {
			this.messages.push(args);
		}
		unpatch() {
			console[this.type] = this.old;
		}
	}

	let warnPatch;

	beforeEach(function() {
		warnPatch = new Monkey("warn");
	});

	afterEach(function() {
		warnPatch.unpatch();
	});

	describe("lexer", function() {
		it("should handle basic tags", function() {
			assert.strictEqual(lexer("{{foo}} {{bar}} {{:test.something}} () content {{/test.something}}"), "ϾfooϿ ϾbarϿ Ͼ:test.somethingϿ () content Ͼ/test.somethingϿ");
		});

		it("should handle parens", function() {
			assert.strictEqual(lexer("{{foo.bar().baz(function() {}).qux(function() { console.log(')'); stuff = \")\"; data = \"{{tag}}\"; }).moo}}"), "Ͼfoo.barԒ(Ԓ).bazԒ(function() {}Ԓ).quxԒ(function() { console.log(')'); stuff = \")\"; data = \"{{tag}}\"; }Ԓ).mooϿ");
		});

		it("should does not handle js comments", function() {
			assert.strictEqual(lexer("{{~exec(function() { var foo = 'something'; // ignore ) this \n var bar = false })}}"), "Ͼ~execԒ(function() { var foo = 'something'; // ignore Ԓ) this \n var bar = false })Ͽ");
			assert.strictEqual(lexer("{{~exec(function() { var foo = true; /* ) /// ignore multi \n and this \n and this */ var bar = false })}}"), "Ͼ~execԒ(function() { var foo = true; /* Ԓ) /// ignore multi \n and this \n and this */ var bar = false })Ͽ");
		});

		it("should remove comments", function() {
			assert.strictEqual(lexer("{{stuff}} {{!--- content {{foo}} ---}} {{stuff}}"), "ϾstuffϿ  ϾstuffϿ");
			assert.strictEqual(lexer("{{stuff}} {{!------ content --> <!-- ------}} {{stuff}}"), "ϾstuffϿ  ϾstuffϿ");
		});

		it("should unlex", function() {
			assert.strictEqual(unlex("ϾfooϿ ϾbarϿ Ͼ:test.somethingϿ content Ͼ/test.somethingϿ"), "{{foo}} {{bar}} {{:test.something}} content {{/test.something}}");
		});
	});

	describe("filler", function() {
		it("should do if else", function() {
			const tests: [string, object, string][] = [
				// chekc standard if statement
				["{{:foo}}{{data}}{{?}}{{data2}}{{/}}", { foo: true, data: "dataValue", data2: "dataValue2" }, "dataValue"],
				["{{:foo}}{{data}}{{?}}{{data2}}{{/}}", { foo: false, data: "dataValue", data2: "dataValue2" }, "dataValue2"],
				// check two level if statement
				["{{:foo}}{{data}}{{?:bar}}{{data2}}{{?}}{{data3}}{{/}}", { foo: false, bar: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3" }, "dataValue2"],
				["{{:foo}}{{data}}{{?:bar}}{{data2}}{{?}}{{data3}}{{/}}", { foo: false, bar: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3" }, "dataValue3"],
				// check three level if statement
				["{{:foo}}{{data}}{{?:bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: false, bar: false, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue3"],
				["{{:foo}}{{data}}{{?:bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: false, bar: false, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue4"],
				// check that inner nesting is working
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: true, bar: true, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: true, bar: true, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: true, bar: false, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue2"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: true, bar: false, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue2"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: false, bar: true, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue3"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: false, bar: true, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue4"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: false, bar: false, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue3"],
				["{{:foo}}{{:bar}}{{data}}{{?}}{{data2}}{{/}}{{?}}{{:baz}}{{data3}}{{?}}{{data4}}{{/}}{{/}}", { foo: false, bar: false, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue4"],
				// check that other constructs work inside if statements
				["{{+inner}}{{#data}}{{@data}}{{/data}}{{/}}{{:foo}}foo{{#data}}{{@data}}{{/}}{{>inner}}{{?}}bar{{#data}}{{@data}}{{/}}{{>inner}}{{/}}", { foo: true, data: ["one", "two"] }, "fooonetwoonetwo"],
				["{{+inner}}{{#data}}{{@data}}{{/data}}{{/}}{{:foo}}foo{{#data}}{{@data}}{{/}}{{>inner}}{{?}}bar{{#data}}{{@data}}{{/}}{{>inner}}{{/}}", { foo: false, data: ["one", "two"] }, "baronetwoonetwo"],
				// check if not if mixes
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: true, bar: true, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: true, bar: true, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: true, bar: false, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: true, bar: false, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: false, bar: true, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue3"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: false, bar: true, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue4"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: false, bar: false, baz: true, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue2"],
				["{{:foo}}{{data}}{{?!bar}}{{data2}}{{?:baz}}{{data3}}{{?}}{{data4}}{{/}}", { foo: false, bar: false, baz: false, data: "dataValue", data2: "dataValue2", data3: "dataValue3", data4: "dataValue4" }, "dataValue2"],
				// check spacing
				["a{{:foo}}b{{data}}c{{?:bar}}d{{data}}e{{?!baz}}f{{data}}g{{?}}h{{data}}i{{/}}j", { foo: true, bar: true, baz: true, data: "dataValue" }, "abdataValuecj"],
				["a{{:foo}}b{{data}}c{{?:bar}}d{{data}}e{{?!baz}}f{{data}}g{{?}}h{{data}}i{{/}}j", { foo: false, bar: true, baz: true, data: "dataValue" }, "addataValueej"],
				["a{{:foo}}b{{data}}c{{?:bar}}d{{data}}e{{?!baz}}f{{data}}g{{?}}h{{data}}i{{/}}j", { foo: false, bar: false, baz: true, data: "dataValue" }, "ahdataValueij"],
				["a{{:foo}}b{{data}}c{{?:bar}}d{{data}}e{{?!baz}}f{{data}}g{{?}}h{{data}}i{{/}}j", { foo: false, bar: false, baz: false, data: "dataValue" }, "afdataValuegj"]
			]

			tests.forEach(function(val) {
				assert.strictEqual(fill(val[0], val[1]), val[2]);
			});
		});

		it("should fail silently diving into subproperty of string", function() {
			const html = "{{key.bar}}";
			const result = fill(html, { key: "" });
			assert.equal(result, "");
		});

		it("should encode variables", function() {
			const keyString = "<foo> \"double\" 'single' ! @ # $ % ^ & * ( ) { } | [ ] \\ ; ' : , . / < > ?";

			assert.equal(fill("{{%key}}", { key: keyString }), "&lt;foo&gt; &quot;double&quot; &apos;single&apos; ! @ # $ % ^ &amp; * ( ) { } | [ ] \\ ; &apos; : , . / &lt; &gt; ?");

			assert.strictEqual(fill("{{%%key}}", { key: keyString }), "%3Cfoo%3E%20%22double%22%20%27single%27%20!%20%40%20%23%20%24%20%25%20%5E%20%26%20*%20(%20)%20%7B%20%7D%20%7C%20%5B%20%5D%20%5C%20%3B%20%27%20%3A%20%2C%20.%20%2F%20%3C%20%3E%20%3F");
		});

		it("should return yes", function() {
			assert.equal("yes", fill("{{key}}", { key: "yes" }));
		});

		it("should output true/false", function() {
			assert.equal("true", fill("{{key}}", { key: true }));
		});

		it("should do if statements", function() {
			const tests: [object, boolean][] = [
				[{ foo: "string" }, true],
				[{ foo: "" }, false],
				[{ foo: ["array"] }, true],
				[{ foo: [] }, false],
				[{ foo: { key: "value" } }, true],
				[{ foo: {} }, false],
				[{ foo: true }, true],
				[{ foo: false }, false],
				[{ foo: null }, false],
				[{ foo: undefined }, false],
				[{ foo: 0 }, false],
				[{ foo: NaN }, false],
				[{ foo: 1 }, true],
				[{ foo: -1 }, true],
				[{ foo: new Date() }, true]
			]

			tests.forEach(function(val, i) {
				assert.equal(fill("{{:foo}}yes{{/foo}}", val[0]) === "yes", val[1], JSON.stringify(val[0]) + " should have returned " + val[1]);
			});

			// test shortend closing tag
			assert.equal(fill("{{:foo}}yes{{/}}", { foo: "yes" }), "yes");
		});

		it("should do not if statements", function() {
			const tests: [object, boolean][] = [
				[{ foo: "string" }, false],
				[{ foo: "" }, true],
				[{ foo: ["array"] }, false],
				[{ foo: [] }, true],
				[{ foo: { key: "value" } }, false],
				[{ foo: {} }, true],
				[{ foo: true }, false],
				[{ foo: false }, true],
				[{ foo: null }, true],
				[{ foo: undefined }, true],
				[{ foo: NaN }, true],
				[{ foo: 0 }, true],
				[{ foo: 1 }, false],
				[{ foo: -1 }, false],
				[{ foo: new Date() }, false]
			]

			tests.forEach(function(val, i) {
				assert.equal(fill("{{!foo}}yes{{/foo}}", val[0]) === "yes", val[1], JSON.stringify(val[0]) + " should have returned " + val[1]);
			});

			// test shortend closing tag
			assert.equal(fill("{{!foo}}yes{{/}}", { foo: "" }), "yes");
		});

		it("should prepend during and after content with sections", function() {
			// goatee has has to prepend non-tag characters within tags properly, test here to ensure it's doing it properly
			assert.equal(fill("AA {{#foo}} BB {{bar}} DD {{/foo}} EE", { foo: { bar: "CC" } }), "AA  BB CC DD  EE");
		});

		it("should access properties and prototypes on objects and arrays", function() {
			const data = {
				foo: [1,2,3],
				bar: {
					inner: "foo"
				},
				baz: 5
			}

			assert.equal(fill("{{foo.length}} {{bar.inner}} {{baz.toString()}}", data), "3 foo 5");
		});

		it("should not fail on recursive undefined", function() {
			const html = "{{foo.bar.baz.qux}}";

			assert.equal(fill(html, {}), "");
		});

		it("should allow partials", function() {
			const html = "{{>foo}}";
			const foo = "{{key}}";

			const result = fill(html, { key: "yes" }, { foo: foo });
			assert.ok(result === "yes")
		});

		it("should allow declaration of partials", function() {
			var html = "{{+foo}}{{foo}}{{bar()}}{{/foo}}{{>foo}}";

			var result = fill(html, { foo: "yes", bar: function() { return "yes" } }, { foo: "fake" });
			assert.equal(result, "yesyes");

			var html = "{{+foo}}{{#data}}{{foo}}{{/data}}{{/foo}}{{>foo}}";
			var result = fill(html, { data: [{ foo: "one" }, { foo: "two" }] });
			assert.equal(result, "onetwo");
		});

		it("should allow partials with mixed case", function() {
			const html = "{{>FoO}}";
			const foo = "{{key}}";

			const result = fill(html, { key: "yes" }, { FoO: foo });
			assert.ok(result === "yes");
		});

		it("should give precendence to exact case match in partials", function() {
			const html = "{{>FoO}}";

			const result = fill(html, { key: "yes" }, { foo: "NO", foO: "NO", FoO: "{{key}}" });
			assert.ok(result === "yes");
		});

		it("should give partials access to data, global and extraData", function() {
			const html = "{{+foo}}{{*foo(data.foo, global.bar, extra.row, helpers.equal)}}{{/foo}}{{#array}}{{>foo}}{{/array}}"

			const data = {
				array: [{ foo: "yes" }]
			}

			const global = {
				foo: function(arg1, arg2, arg3, arg4) {
					return arg1 + " " + arg2 + " " + arg3 + " " + arg4(1, 1);
				},
				bar: "yes2",
			}

			assert.equal(fill(html, data, {}, global), "yes yes2 1 true");
		});

		it("should ignore case for keys", function() {
			const html = "{{FoO}}";

			const result = fill(html, { foo: "yes" });
			assert.equal(result, "yes");
		});

		it("should give precendence to exact case match in keys", function() {
			const html = "{{FoO}}";

			const result = fill(html, { FoO: "yes", foo: "no" });
			assert.equal(result, "yes");
		});

		it("should iterate over arrays with extraData and mixed case", function() {
			const html = "{{#data}}{{@row}} {{@FiRst}} {{@last}} {{@eVeN}} {{@ODD}} {{/data}}";

			const result = fill(html, { data: [1,2,3] });
			assert.equal(result, "1 true false false true 2 false false true false 3 false true false true ");
		});

		it("should access array rows by key", function() {
			const html = "{{data.1.foo}}";

			const result = fill(html, { data: [1, { foo: "yes" }, 3] });
			assert.equal(result, "yes");
		});

		it("should step into objects", function() {
			const html = "{{#data}}{{#foo}}{{bar}}{{/foo}}{{/data}}"

			const result = fill(html, { data: { foo: { bar: "yes" } } });
			assert.equal(result, "yes");
		});

		it("should autocreate global vars", function() {
			const html = "{{*foo}}";

			const result = fill(html, { foo: "yes" });
			assert.equal(result, "yes");
		});

		it("should access global vars", function() {
			const html = "{{#*foo}}{{bar}}{{/*foo}}";

			const result = fill(html, { foo: "notarray" }, {}, { foo: { bar: "yes" } });
			assert.equal(result, "yes");
		});

		it("should backTrack", function() {
			assert.equal(fill("{{#foo}}{{-bar}}{{/foo}}", { foo: { bar: "no" }, bar: "yes" }), "yes");
			assert.equal(fill("{{-foo}}", { foo: "no" }), "");
			assert.equal(fill("{{#foo}}{{----bar}}{{/}}", { foo: [1,2,3] }), "");
			assert.equal(fill("{{#foo}}{{#bar}}{{data}}{{-data}}{{--data}}{{---data}}{{/bar}}{{/foo}}", { foo: [{ bar: [{ data: "1" }], data: "2" }], data: "3" }), "123");
			assert.equal(fill("{{#foo}}{{:-bar}}yes{{/-bar}}{{!bar}}yes{{/bar}}{{/foo}}", { foo: [{ bar: false }], bar: true }), "yesyes");
		});

		it("should call function", function() {
			const data = {
				foo: function() { return "yes" }
			}

			assert.equal(fill("{{foo}}", data), "");
			assert.equal(fill("{{foo()}}", data), "yes");
		});

		it("should not improperly hold function args", function() {
			const data = {
				foo: function(arg1) { return arg1 },
				bar: function(arg2) { return arg2 }
			}

			assert.strictEqual(fill("{{foo('test')}}{{bar()}}{{bar('test3')}}", data), "testtest3");
		});

		it("should handler string, number, boolean, array, object and function in function arguments", function() {
			const data = {
				foo: function(arg1, arg2, arg3, arg4, arg5, arg6) {
					assert.equal(arg1, "yes");
					assert.equal(arg2, 5);
					assert.equal(arg3, true);
					assert.deepEqual(arg4, [1,2,3]);
					assert.deepEqual(arg5, { foo: "bar" });
					assert.equal(arg6(), "passed");

					return "yes";
				}
			}

			const html = "{{foo('yes', 5, true, [1,2,3], { foo : 'bar' }, function() { return 'passed' })}}";

			assert.equal(fill(html, data), "yes");
		});

		it("should chain function calls", function() {
			const html = '{{foo(2).bar({ "foo" : "bar()" }).baz(1,2,3)}}';

			const result = fill(html, {
				foo: function(args) {
					assert.equal(args, 2);

					return {
						bar: function(args) {
							assert.equal(args.foo, "bar()");

							return {
								baz: function(args, args2, args3) {
									assert.equal(args, 1);
									assert.equal(args2, 2);
									assert.equal(args3, 3);

									return "yes";
								}
							}
						}
					}
				}
			});

			assert.equal(result, "yes");
		});

		it("should have access to data, global and extraData", function() {
			const html = "{{#array}}{{*foo(data.foo, global.bar, extra.row)}}{{/array}}"

			const data = {
				array: [{ foo: "yes" }]
			}

			const global = {
				foo: function(arg1, arg2, arg3) {
					return arg1 + " " + arg2 + " " + arg3;
				},
				bar: "yes2",
			}

			assert.equal(fill(html, data, {}, global), "yes yes2 1");
		});

		it("should not have access to important variables", function() {
			const allUndefined = function(arg1) { return arg1.filter(function(val) { return val !== undefined && val !== null }).length === 0; }

			const html = "{{foo([window, process, require, setTimeout, setInterval, clearTimeout, clearInterval, __dirname, __filename, module, exports, Buffer, define])}}";
			assert.equal(fill(html, { foo: allUndefined }), "true");
		});

		it("should parse eval in function call", function() {
			const html = '{{foo({ "foo" : "foo_value", "bar" : 1, "baz" : true }, 2)}}';

			class MyObj {
				myFoo: string
				constructor() {
					this.myFoo = "foo";
				}
				foo(args, args2) {
					assert.equal(this.myFoo, "foo"); // check to ensure 'this' is maintained
					assert.equal(args.foo, "foo_value");
					assert.equal(args.bar, 1);
					assert.equal(args.baz, true);
					assert.equal(args2, 2);

					return "yes";
				}
			}

			const result = fill(html, new MyObj());

			assert.equal(result, "yes");
		});

		it("should not throw error on bogus javascript", function() {
			const html = "{{foo(broken)}}";
			const data = {
				foo: function(arg1) {
					throw new Error("Should not get here");

					return "no";
				}
			}

			assert.equal(fill(html, data), "");
			assert.equal(warnPatch.messages[0][0], "broken is not defined");
		});

		it("should execute equal helper", function() {
			// standard equality checks
			assert.equal(fill("{{~equal(1,1)}}", {}), "true");
			assert.equal(fill('{{~equal(data.foo, true)}}', { foo: true }), "true");
			assert.equal(fill('{{~equal(data.foo, data.bar)}}', { foo: 5, bar: 5 }), "true");
			assert.equal(fill('{{~equal(1,3)}}', {}), "false");

			// equality checks with bad data
			assert.equal(fill('{{:~equal(global.data.foo.bar, 3)}}yes{{/}}', {}), "");
			assert.equal(fill('{{!~equal(global.data.foo.bar, 3)}}yes{{/}}', {}), "yes");
		});

		it("should execute equal helper while iterating over array to other element", function() {
			const data = {
				array: [{ label: "Foo", value: "foo" }, { label: "Bar", value: "bar" }, { label: "Baz", value: "foo" }],
				current: "foo"
			}

			assert.equal(fill("{{#array}}{{~equal(data.value, global.current)}} {{/array}}", data), "true false true ");
		});

		it("should execute contains helper", function() {
			assert.equal(fill("{{~contains([1,2,3], 2)}}", {}), "true");

			// test various cases where variables are undefined or improper types
			assert.equal(fill("{{:~contains(data.foo.bar, 2)}}yes{{/}}", {}), "");
			assert.equal(fill("{{:~contains(data.foo.bar, fake)}}yes{{/}}", {}), "");
			assert.equal(fill("{{!~contains(data.foo.bar, 2)}}yes{{/}}", {}), "yes");
			assert.equal(fill("{{:~contains(5, 2)}}no{{/}}", {}), "");

			// ensure it works for the odd case of a string value on both sides
			assert.equal(fill("{{:~contains('foo', 'f')}}yes{{/}}", {}), "yes");

			const data = { array: [{ value: 1 }, { value: 2 }, { value: 1 }, { value: 3 }], current: [1,3] };
			assert.equal(fill("{{#array}}{{~contains(global.current, data.value)}} {{/array}}", data), "true false true true ");
		});

		it("should execute setVar and var helper", function() {
			assert.equal(fill("{{~setVar('foo', 'something awesome')}}{{~var.foo}}", {}), "something awesome");
			assert.equal(fill("{{~setVar('foo', (function() { return data.foo.length === 3; })())}} {{:~var.foo}}yes{{/~var.foo}}", { foo: [1,2,3] }), " yes");
			assert.equal(fill("{{~setVar('foo', 'yes')}}{{~equal(helpers.var.foo, 'yes')}}", {}), "true");

			// ensure set var from previous fill() call is not present
			assert.equal(fill("{{:~var.foo}}no{{/~var.foo}}", {}), "");
		});

		it("should execute exec helper", function() {
			// standard test
			assert.equal(fill("{{~exec(function() { return 'yes' })}}", {}), "yes");
			assert.equal(fill("{{~exec(function() { return global.foo + ' ' + data.foo; })}}", { foo: "local" }, {}, { foo: "global" }), "global local");
			// ensure it fails gracefully for non-functions
			assert.equal(fill("{{~exec('foo')}}", {}), "foo");
			// ensure it fails gracefully for execing functions which throw errors
			assert.equal(fill("{{~exec(function() { fake.is.real = foo; return 'no' })}}", {}), "");
			// ensure it does not allow access to important variables
			assert.equal(fill("{{~exec(function() { return process === undefined })}}", {}), "true");

			// ensure it can exec without an inner function
			const data = { foo: "bar", baz: [1,2] };
			assert.equal(fill("{{~exec(JSON.stringify(data))}}", { foo: "bar", baz: [1,2] }), JSON.stringify(data));
		});

		it("should handle complex nesting", function() {
			// inner content has }} which needs to be interpreted as a non-tag, in addition it contains ). which needs to not-trick the parenthesis tag term processor
			assert.equal(fill("{{~exec(function() { return JSON.stringify({ test : { foo : ([]).indexOf('i') }}) })}}", {}), '{"test":{"foo":-1}}');
			// another test more symbols, parens and even more garbage
			assert.equal(fill('{{~setVar("isValid", data.published === true && (new Date()).getTime() > data.startTime)}}{{~var.isValid}}', { published: true, startTime: 10 }), "true");
		});

		it("should handle multi-line exec", function() {
			const template = "{{~exec(function() {	\r\n\
				var temp = data.foo + '_trail';		\r\n\
				return temp;						\r\n\
			})}}";

			assert.equal(fill(template, { foo: "fooValue" }), "fooValue_trail");
		});

		it("should output partial", function() {
			// output standard partial
			assert.equal(fill("{{~partial('foo')}}", {}, { foo: "{{stuff}}" }), "{{stuff}}");

			// output dynamically declared partial
			assert.equal(fill("{{+test}}{{foo}}{{/}}{{~partial('test')}}", {}), "{{foo}}");
		});

		it("should execute log helper", function() {
			let result;

			// monkeyPatch console.log
			const logPatch = new Monkey("log");

			fill("{{~log(data)}}", { foo: "something", bar: [1] });
			assert.equal(logPatch.messages[0][0].foo, "something");
			assert.equal(logPatch.messages[0][0].bar[0], 1);

			//console.log = oldLog;
			fill("{{#data}}{{~log(data, extra)}}{{/data}}", { data: [{ foo: "fooValue" }] });
			assert.equal(logPatch.messages[1][0].foo, "fooValue");
			assert.equal(logPatch.messages[1][1].row, 1);

			// bad variable should effectively error
			logPatch.messages = [];
			result = undefined;
			fill("{{~log(bogus)}}", { foo: true });
			assert.equal(logPatch.messages.length, 0);

			const data = { a: "a" };
			//@ts-expect-error
			data.b = data;
			fill("{{~log(data)}}", data);
			assert.equal(logPatch.messages[0][0].a, "a");
			assert.equal(logPatch.messages[0][0].b.a, "a");

			// remove console.log monkeyPatch
			logPatch.unpatch();
		});

		it("should stringify", function() {
			var result = fill("{{~stringify(data.foo)}}", { foo: { key: "something", arr: [1,2] } });
			assert.strictEqual(result, '{"key":"something","arr":[1,2]}');

			var result = fill("{{~stringify(data.foo, null, '\t')}}", { foo: { key: "something", arr: [1,2] } });
			assert.strictEqual(result, '{\n\t"key": "something",\n\t"arr": [\n\t\t1,\n\t\t2\n\t]\n}');
		});

		it("should not run preserved html", function() {
			const inner = "{{#foo}} {{something}} {{/foo}} {{>more}} {{#foo}}{{#bar}}{{>foo}}{{/bar}}{{/foo}}";
			assert.equal(fill("{{$}}" + inner + "{{/}}", { foo: "no" }), inner);
			const html = "{{foo}} {{>more}} {{bar}}";
			assert.equal(fill(html, { foo: "foo", bar: "bar" }, { more: "{{$}}{{foo}}{{/}}" }), "foo {{foo}} bar");
		});

		it("should not add partials within perserved html", function() {
			const html = "{{$}}{{+test}}{{foo}}{{/test}}{{/}}{{>test}}";
			const result = fill(html, { foo: "no" });
			assert.equal(result, "{{+test}}{{foo}}{{/test}}");
		});

		it("should leave non-goatee code unchanged", function() {
			assert.equal(fill("}}", {}), "}}");
		});

		// Odd regex situation, not sure how to classify this, the regex parser was unable to handle this previously for some reason
		// testing to prevent regression
		it("should handle odd nesting situation", function() {
			const template = "{{~setVar('something', true)}}{{foo(data.bar).baz(data.baz)}}";
			const data = {
				foo: function(bar) {
					return {
						baz: function(baz) {
							return bar + "_" + baz;
						}
					}
				},
				bar: "barValue",
				baz: "bazValue"
			}

			assert.equal(fill(template, data), "barValue_bazValue");
		});

		it("should optionally cache template processing", function() {
			const template = "{{data}}";

			var temp = new Goatee();
			assert.strictEqual(temp.fill(template, { data: "yes" }), "yes");
			assert.deepEqual(temp._templateCache, {});

			var temp = new Goatee({ cache: true });
			assert.strictEqual(temp.fill(template, { data: "yes" }), "yes");
			assert.strictEqual(temp._templateCache[template].raw, "{{data}}");
			assert.strictEqual(temp._templateCache[template].html, "ϾdataϿ");
			assert.notEqual(temp._templateCache[template].context, undefined);

			assert.strictEqual(temp.fill(template, { data: "yes" }), "yes");
		});

		it("should handle regex", function() {
			const tests: [string, object, string][] = [
				["{{~exec(new RegExp('\\\\(success').toString())}}", {}, "/\\(success/"],
				['{{~exec(data.url.replace(/r\\//, "b"))}}', { url: "/foo/bar/baz/" }, "/foo/babbaz/"],
				['{{~exec(data.url.replace(/[(]/, "asdf"))}}', { url: "some value (foo)" }, 'Ͼ~execԒ(data.url.replace(/[(]/, "asdf"))}}'] // paren throws off the lexer
			]

			tests.forEach(function(val, i) {
				assert.strictEqual(fill(val[0], val[1]), val[2]);
			});
		});

		it("should allow nested fills", function() {
			const tests: [Parameters<Goatee["fill"]>, string][] = [
				[
					["{{~fill(helpers.partial(data.foo), { success : true })}}", { foo: "myPartial" }, { myPartial: "{{success}}", wrongPartial: "{{fail}}" }],
					"true"
				],
				[
					// right now helpers do not pass through to the next level fills
					["{{~setVar('foo', 'fooValue')}}{{~fill('{{~var.foo}}', {})}}", {}],
					""
				],
				[
					// plugins are shared since it is the same root goatee object executing both fills()
					["{{~plugins.foo.test()}} {{~fill('{{~plugins.foo.test()}}', {})}}", {}],
					"testResult testResult"
				]
			]

			const g = new Goatee();
			g.addPlugin("foo", { test: function() { return "testResult" } });

			tests.forEach(function(val, i) {
				assert.strictEqual(g.fill(...val[0]), val[1]);
			});
		});

		describe("test array", function() {
			const tests = [
				{
					name: "Not improperly fill missing keys with key at undefined",
					template: "{{foo.bar}}",
					data: { foo: { undefined: "bogus" } },
					result: ""
				},
				{
					name: "should fill if key is named undefined",
					template: "{{foo.undefined}}",
					data: { foo: { undefined: "success" } },
					result: "success"
				},
				{
					name: "exec should warn on bad function def",
					template: "{{~exec(bogus())}}",
					data: {},
					result: "",
					messages: [
						"bogus is not defined"
					]
				},
				{
					name: "exec should receive each argument type",
					template: "{{~setVar('foo', 'helpersFoo')}}{{#obj}}{{~exec([data.foo, global.foo, helpers.var.foo, extra.row].join(','))}}{{/}}",
					data: {
						foo: "globalFoo",
						obj: [
							{
								foo: "dataFoo"
							}
						]
					},
					result: "dataFoo,globalFoo,helpersFoo,1"
				}
			]

			tests.forEach(function(test) {
				it(test.name, function() {
					const result = fill(test.template, test.data);
					assert.strictEqual(result, test.result);

					if (test.messages !== undefined) {
						test.messages.forEach(function(val, i) {
							assert.strictEqual(warnPatch.messages[i][0], val);
						});
					}
				});
			});
		});
	});

	describe("plugins", function() {
		it("should have instance version for plugins", function() {
			const temp = new Goatee();

			temp.addPlugin("test", { io: function(val) { return "fromPlugin" + val } });

			assert.equal(temp.fill("{{foo}}{{*foo}}{{~plugins.test.io(data.foo)}}", { foo: "fooLocal" }), "fooLocalfooLocalfromPluginfooLocal");
			assert.equal(temp.fill("{{foo}}{{*foo}}{{~plugins.test.io(data.foo)}}", { foo: "fooLocal" }, {}, { foo: "fooGlobal" }), "fooLocalfooGlobalfromPluginfooLocal");
			assert.equal(temp.fill("{{foo}}{{*foo}}{{>foo}}", { foo: "fooLocal" }, { foo: "partial" }, { foo: "fooGlobal" }), "fooLocalfooGlobalpartial");
		});
	});

	it("Verify types", async () => {
		execSync("yarn run types", { stdio: "inherit" });
	});

	it("Run linter", async () => {
		execSync("yarn run style", { stdio: "inherit" });
	});
});
