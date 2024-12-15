# goatee

`npm install goatee`

Powerful yet simple templating system with Mustache style syntax and many more features. Works in node and browser with requirejs.

# Documentation

* [Api Documentation](#api-documentation)
    * [Fill](#fill)
    * [Goatee](#goatee)
* [Tags](#tags)
    * [Quick Reference](#tags-quick-reference)
    * [Understanding Tags](#understanding-tags)
    * [JS Expressions](#js-expressions)

# Features

1. Works client-side (traditional and requirejs), and within Node
1. Super simple syntax.
1. Fills templates based on strings, does not require any specific folder structure.
1. Similar syntax to Mustache and Handlebars.

# Getting started

`npm install goatee`

```js
// node
var goatee = require("goatee");
console.log(goatee.fill("{{foo}}", { foo : "success" }));
// success
```

```js
// requirejs
require(["goatee"], function(goatee) {
    console.log(goatee.fill("{{foo}}", { foo : "success" }));
    // success
});
```

```html
<!-- html -->
<script src="goatee/index.js"></script>
<script>
    console.log(goatee.fill("{{foo}}", { foo : "success" }));
    // success
</script>
```

# API Documentation

### Fill

`goatee.fill(templateString, data, partials, globalData)`

Fills a template with data.

Returns `string`.

* `templateString` - `string` - `required` - Template string to be filled with data.
* `data` - `object` - `default {}` - Data which will fill the template.
* `partials` - `object` - `default {}` - Object with keys containing partials, sub-templates to be used within the template. See partials for more information.
* `globalData` - `object` - `defaults to value passed to data` - Object with global data which can be accessed anywhere within the template.

### Goatee

`goatee.Goatee`

You can add plugins to Goatee allowing you to access complex code within your templates. If you need to do so you will need to create an instance of goatee to store your plugins.

```js
var g = new goatee.Goatee();
g.fill("{{foo}}", { foo : "test" }) === "test";
```

### Adding Plugins `Goatee.prototype.addPlugin("name", plugin)`

```js
var lodash = require("lodash");
var g = new goatee.Goatee();
g.addPlugin("lodash", lodash);

// output a random element from the array using lodash.sample
g.fill("{{~plugins.lodash.sample(data.arr)}}", { data : [1,2,3] });
```

### Locking

Often in JS you'll want to create a consistent Goatee entity which you pass around to multiple places so that they already have their plugins loaded in. In this situation you will want to lock Goatee so that code cannot add more plugins later on. If this isn't done, it's possible for one branch of your code to add the plugin, but then another plugin depend on it. This will cause odd failures that will work sometimes and not others depending on which code path is run first.

myGoatee.js
```js
var goatee = require("goatee");
var lodash = require("lodash");
var moment = require("moment");

var g = new goatee.Goatee();
g.addPlugin("lodash", lodash);
g.addPlugin("moment", moment);
// lock the instance so that downstream code can't add more plugins
g.lock();
module.exports = g;
```

Now, downstream you can simply `require("myGoatee.js")` and it will have the plugins loaded in for you.

## Tags

### Tag Quick Reference

1. `{{key}}` - Output variable
1. `{{:key}} {{/key}}` - Positive conditional.
1. `{{!key}} {{/key}}` - Negative conditional.
1. `{{:key}} {{?:key2}} {{?!key2}} {{?}} {{/}}` - Complex if/else if/else conditionals.
1. `{{>key}}`- Partial.
1. `{{+key}} {{/key}}` - Custom partial.
1. `{{*key}}` - Global data.
1. `{{#key}} {{key}}` - Section, object or array.
1. `{{%key}}` - HTML encode (`'><&"`)
1. `{{%%key}}` - URL encode using encodeURIComponent in addition to encoding the `'` character
1. `{{@key}}` - Extra data during array iteration.
1. `{{~key}}` - Helpers.
1. `{{$}} {{/key}}` - Preserve.
1. `{{---key}}` - Reach up X number of scopes based on count of `-`.

### Understanding tags

All tags follows the pattern `{{[operator][lookup][locatorChain]}}`.

`operators` are `: ! + > $ %`. They instruct the system to DO something with the data, such as reaching inside, checking if it's true. When no operator is present the content at the locator will be output. Tags can never have more than one operator!

`lookup` are `* @ ~`. They instruct the system where to look for the data. The `lookup` should always happen after the `operator`, e.g. `{{#~var.foo}} {{/}}`.

`locatorChain` is a dot seperated path to access the variable . Locators match pretty much 1 to 1 to native javascript code. In example in goatee a locator of `foo().bar.baz()` works nearly the same as it would if it was done in JS. The only caveat is that if any step of chain returns `undefined` the system will not throw an error, instead the tag will return falsy.

**Casing:** When the `locatorChain` is processing, it will prefer keys which have an exact case match, `{{FoO}}` to data `FoO`. In the event there is not a case match it will use a data key who's `toLowerCase()` matches the `toLowerCase()` of the locator piece, such as `{{FoO}}` matching data `foO` because they both have the same `toLowerCase()` of `foo`.

 Tag types which have a closing and opening tag such as positive conditional, negative conditional, and custom partial do not require that the closing tag matches the name.
    3. `{{#key}} {{/key}}` is the preferred method because it matches HTML syntax.
    4. `{{#key}} {{/}}` also works and is used often when the opening tag is very long, such as when using a helper expression.

Valid Tag Examples

1. `{{foo}}` - Output a simple variable
1. `{{%foo}}` - Output a variable and encode.
1. `{{#foo().baz}} {{/}}` - Iterate over the value at `foo().baz` in normal data.
1. `{{#*data.bar()}} {{/}}` - Iterate over the value at `globalData.bar`.
1. `{{foo(data.bar).baz}}` - Output a variable which is contained by calling the function passed at `foo` with an argument which is the value passed at `bar` and then get `baz` out of that result.
1. `{{:~var.test}} {{/}}` - Test if a helper declared var is truthy.

### JS Expressions

You can execute arbitrary javascript within certain tags. In doing so it will `eval` the contents but many global variables are not accessible such as `require` `window` `setTimeout` etc.

**NOTE:** While in JS expressions all of your data is namespaced.

1. `data.` - Accesses the data at the current context.
1. `global.` - Access the data in the globalData context (`*`).
1. `helpers.` - Access the helpers (`~`).
1. `extra.` - Access the extraData (`@`).

**NOTE:** JS expressions can not return async.

Example, output a formatted `moment` object.
```html
{{moment(data.myData).format("LLLL")}}
```
JS
```js
var result = goatee.fill(template, { moment : moment, myData : new Date(2011, 1, 1) });
```
Result. Notice how we pass in the moment object and the date. The key myData is accessed using `data.myData` within the JS expression. **All or your data is namespaced within JS expressions!**
```html
Tuesday, February 1, 2011 12:00 AM
```

## Tag Reference

### Output variable `{{var}}`

If the variable exists and is a simple value (string, integer, boolean) it will output it's `toString()` equivalent.

To html encode a variable (escaping "<>&) pass `{{%var}}`

```js
var result = goatee.fill("{{foo}}", { foo : "test" });
result === "test";

var result = goatee.fill("{{%foo}}", { foo : "<div>Test</div>" });
result === "&lt;div&gt;Test&lt;/div&gt;";

var result = goatee.fill("{{%%foo}}", { foo : "foo 'bar' \"baz\" qux !@#$" });
result === "foo%20%27bar%27%20%22baz%22%20qux%20!%40%23%24"
```

### Positive conditional `{{:var}} content {{/var}}` (if true)

If the value of `var` evaluates to true, see conditions below, the it will run the contents within the conditional. If the value of `var` fails to evaluate to true then the contents of the tag will return "" in their entirety.

The following cases will run the contents of the tag.

1. Arrays with length > 0
1. Objects that have keys.
1. Strings which are not "" and are not "false".
1. Any number.

Template
```html
{{:image}}
    <img src="{{image}}"/>
{{/image}}
```
JS
```js
var result = goatee.fill(template, { image : "http://www.test.com/image.png" });
result === '<img src="http://www.test.com/image.png"/>';

var result = goatee.fill(template, {});
result === "";
```

### Negative conditional `{{!var}} content {{/var}}` (if false)

If the value of `var` evaluates to false, see conditions below, the it will run the contents within the conditional. If the value of `var` fails to evaluate to false then the contents of the tag will return "" in their entirety.

The following cases will run the contents of the tag.

1. Arrays with length === 0
1. Objects that have 0 keys.
1. Strings which are "" or are "false".
1. `undefined`
1. `false`

### If/Else If/Else `{{:var}} exists {{?}} not exists {{/var}}`

`{{:foo}}` and `{{!foo}}` conditionals can be used in conjunction with `{{?}}` and `{{?:bar}}` type statements to create `if/else` and `if/else if/else` type statements by nesting very similar to how they work in most languages

Simple example of if/else
```html
{{:foo}}
  if foo is truthy
{{?}}
  else
{{/}}
```

Example of if/else if with no else
```html
{{:foo}}
  if foo is truthy
{{?:bar}}
  else if bar is truthy
{{/}}
```

Mixing everything
```html
{{:foo}}
  if foo is truthy
{{?!bar}}
  else if bar is falsey
{{?:baz}}
  else if baz is truthy
{{?}}
  else
{{/}}
```

### Sections `{{#var}} content {{/var}}`

Sections are used for processing arrays and objects, changing the current context to new context.

#### Objects

1. If the value is an object, then the context will become what is at the value of var.

Template
```html
{{#myObj}}
    <div class="{{class}}">{{title}}</div>
{{/myObj}}
```

JS
```js
var result = goatee.fill(template, { myObj : { class : "blueTheme", title : "Goatee" } });
```
Result
```html
<div classs="blueTheme">Goatee</div>
```

#### Arrays

1. If the value of tag variable is an array then contentx of the tag is run for each item in the array. In addition, the current context will refer to the current item.
1. The following special keys are avaiable inside arrays. All row values are 1 based.
    1. `@odd` - True if the current row being processed is odd (1st, 3rd, 5th row).
    1. `@even` - True if the current row being processed is even (2nd, 4th, 6th).
    1. `@row` - The row of the current row being processed.
    1. `@first` - If the row is the first in the array.
    1. `@last` - If the row is the last in the array.
    1. `@data` - References the current context data. Useful when iterating over arrays of strings or numbers.

Template
```html
{{#myArr}}
    <span class="{{:@even}}even{{/even}}">{{key}}</span>
{{/myArr}}
```
JS
```js
var data = {
    myArr : [
        { key : "bar" },
        { key : "baz" },
        { key : "qux" }
    ]
};

var result = goatee.fill(template, data);
```
Result
```html
//result
<span class="">bar</span>
<span class="even">baz</span>
<span class="">qux</span>
```
Using data attributes to create a comma separated list.
```js
var result = goatee.fill("{{#myArr}}{{@data}}{{!@last}},{{/last}}{{/myArr}}", { myArr : [1,2,3] });
result === "1,2,3"
```

### Partials `{{>var}}`

Partials are a way of including micro-templates at run time.

When a partial is run it is always run at the current context. This means if you include a partial while iterating within an array, then the partial will be filled with the data from the content at that array element.

JS
```js
var mainTemplate = "<div class='items'>{{#item}}{{>itemTemplate}}{{/item}}</div>";
var itemTemplate = "<div class='item'>{{title}}</div>";
var data = {
    items : [
        { title : "Foo" },
        { title : "Bar" },
        { title : "Baz" }
    ]
}
var result = goatee.fill(mainTemplate, data, { itemTemplate : itemTemplate });
```
Result
```html
<div class="items">
    <div class="item">Foo</div>
    <div class="item">Bar</div>
    <div class="item">Baz</div>
</div>
```

### Custom Partials `{{+var}} content {{/var}}`

There are times when you want to declare a partial within your template.

Common use-cases

1. Re-using a part of your template multiple times, such as paging buttons above and below a result set.
1. Recursive elements within your template. This is used a lot when representing parent-child situations such as nested multi-level navigation.

Re-using a custom partial
```html
{{+pager}}
    <div class="pager">{{row}} of {{rows}}</div>
{{/pager}}

<div class='resultSet'>
    {{>pager}}
    <div class="items"><!-- item content --></div>
    {{>pager}}
</div>
```
```js
var result = goatee.fill(template, { row : 1, rows : 10, items : [] });
```
Result. Notice how we are able to re-use the pager template.
```html
<div class='resultSet'>
    <div class="pager">1 of 10</div>
    <div class="items"><!-- items content --></div>
    <div class="pager">1 of 10</div>
</div>
```

Recursive template
```html
{{+item}}
    <div class="item">
        <div class="content">{{title}}</div>
        {{:children}}
            <div class="children">
                {{#children}}
                    {{>item}}
                {{/children}}
            </div>
        {{/children}}
    </div>
{{/item}}

<div class="items">
    {{>item}}
</div>
```
JS
```js
var data = {
    title : "Top Level",
    children : [
        { title : "Second Level No Children" },
        {
            title : "Second level Children",
            children : [
                { title : "Third Level" }
            ]
        }
    ]
}

var result = goatee.fill(template, data);
```
Result. Notice how we are able to create a structure which can iterate over itself as deep as our data requires.
```html
<div class="items">
    <div class="item">
        <div class="content">Top Level</div>
        <div class="children">
            <div class="item">
                <div class="content">Second Level No Children</div>
            </div>
            <div class="item">
                <div class="content">Second level Children</div>
                <div class="children">
                    <div class="item">
                        <div class="content">Third Level</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

### Global Data `{{*var}}`

Often while iterating through an array or object you'll want to reference keys that were in the top level context.

If not passed, globalData will default to the root scope of your data.

Global data is accessed with the same locators as normal data. The only difference is that you prefix the key with the `*` symbol.

Template
```html
{{#items}}
    <a href="{{url}}" target="{{*target}}">{{title}}</a>
{{/items}}
```
JS
```js
var data = {
    target : "_blank",
    items : [
        { url : "http://www.google.com", title : "Google" },
        { url : "http://www.bing.com", title : "Bing" }
    ]
}

// we do not pass globalData, therefore globalData === data;
var result = goatee.fill(template, data);
```
Result, notice how the target attribute is filled in even though each item only has a `url` and `title` key. This is possible because the target was pulled from the global scope with `{{*target}}`.
```html
<a href="http://www.google.com" target="_blank">Google</a>
<a href="http://www.bing.com" target="_blank">Bing</a>
```
JS
```js
// now lets do the same command except we'll pass our own globalData hash
var result = goatee.fill(template, data, {}, { target : "_top" });
```
Result
```html
<a href="http://www.google.com" target="_top">Google</a>
<a href="http://www.bing.com" target="_top">Bing</a>
```

### Preserving templates `{{$}} content {{/}}`

There are times when you have a goatee template embedded inside a goatee template and you do not want that template processed right away. A common use-case is when a template is processed server-side but contains a template which is going to be used client-side. If that client-side template isn't preserved, then the contents of that sub-template will end up executed.

```html
<h1>{{pageTitle}}</h1>
<div class="items"></div>
<script type="text/template" id="itemTemplate">
    {{$}}
        <div class="item" data-id="{{id}}">{{title}}</div>
    {{/}}
</script>
```
JS
```js
var result = goatee.fill(template, { pageTitle : "My Title" });
```
Result, notice how the template tags within the script tag remain. This is because the template was preserved using `{{$}}`. Had it not been preserved, it would have executed the `{{id}}` and `{{title}}` tag within it. Now that itemTemplate could be extracted on the client-side and filled using goatee in the browser.
```html
<h1>My Title</h1>
<div class="items"></div>
<script type="text/template" id="itemTemplate">
    <div class="item" data-id="{{id}}">{{title}}</div>
</script>
```

### Reaching Up `{{--foo}}`

You can use globalData to reach up to the top context. Occasionally you don't want to go all the way to the top, you only want to go up one or two levels. In this case you can prefix your locator and it will go up one level for every `-`.

```html
{{#foo}}
    {{#bar}}
        Level1: {{--level}}
        Level2: {{-level}}
        Level3: {{level}}
    {{/bar}}
{{/foo}}
```
```js
var data = {
    foo : {
        bar : {
            level : "three"
        },
        level : "two"
    },
    level : "one"
}
var result = goatee.fill(template, data);
```
Result. In this case we have moved into `foo` and `bar` but we are able to reach up multiple scopes and access data above our current context using the `-`.
```html
Level1: one
Level2: two
Level3: three
```

### Comments

Block comments. Nothing will be output if it is between `{{!--` and `--}}`.

```html
    {{!-- in a comment --}} out of a comment
    {{!--------- in a comment -- -----}} out of a comment
```

## Helpers

Helpers are a `lookup` area which provides access to some useful functions as well as being a place where you can add plugins allowing you to pass additional functionality into your template system.

### helpers.equal `{{:~equal(var1, var2)}} content {{/}}`

Compares the two values and returns if they are equal. The value of `var1` and `var2` can be any JS expression. This is often used to see if a value in a variable matches a specific string or number. Another common use case is checking if multiple conditions are true.

Note: There is no requirement that you use a `:` or `!` with the `equal` helper, but it's quite common unless you actually want to output the word `true` or `false`.

Template
```html
{{#items}}
    <div class="item">
        {{:~equal(data.rank, 1)}}<img src="{{image}}"/>{{/}}
        <h2>{{title}}</h2>
    </div>
{{/items}}
```
JS
```js
var data = {
    items : [
        { title : "Hotel 1", rank : 1, image : "foo.png" },
        { title : "Hotel 2", rank : 2, image : "bar.png" },
        { title : "Hotel 3", rank : 1, image : "baz.png" }
    ]
}
var result = goatee.fill(template, data);
```
Result. In this case we only want to display the image if `rank === 1`.
```html
<div class="item">
    <img src="foo.png"/>
    <h2>Hotel 1</h2>
</div>
<div class="item">
    <h2>Hotel 2</h2>
</div>
<div class="item">
    <img src="baz.png"/>
    <h2>Hotel 3</h2>
</div>
```

### helpers.contains `{{:~contains(arr1, item1)}} content {{/}}`

Contains is a shorthand method for checking if an array contains an item. This is basically a wrapper for `Array.prototype.indexOf`.

```js
var template = '{{~contains(data.arr, 5)}}Yes{{/contains}}';
var result1 = goatee.fill(template, { arr : [1,2,3] });
result1 === "";

var result2 = goatee.fill(template, { arr : [1,2,5,3] });
result1 === "Yes";
```

### helpers.exec `{{~exec(expression or function)}}`

Helpers.exec is used when you need to execute an arbitrary function or JS expression. The content of exec can either be an anonymouse function or an expression.

Passing an anonymous function
```js
var template = '{{~exec(function() { return 'yes'; })}}';
var result = goatee.fill(template, {});
result === "yes";
```
Passing a JS expression
```js
var template = '{{~exec(JSON.stringify(data))}}';
var result = goatee.fill(template, { date : new Date(2011, 1, 1) });
result === '{"date":"2011-02-01T07:00:00.000Z"}';
```

### helpers.log `{{~log(expression or function)}}`

Log is used to dump a variable to the console. This is helpful when you are not aware what variables your template has at it's disposal.

Log current context data
```html
{{~log(data)}}
```

Log all the variables
```html
{{~log(data, global, helpers, extra)}}
```

### helpers.partial `{{~partial("name")}}`

Outputs the contents of a partial as a string. Using this method will not execute that partial, it will output it's content as a plain string. A common use case is if you have a partial template which is intended to be passed to the front-end to be used there.

```html
<script type="text/template" id="myTemplate">
    {{~partial("test")}}
</script>
```
```js
var result = goatee.fill(template, {}, { test : "myPartial {{key}}" });
```
Result. The partial is output unprocessed, so that a client-side goatee can pick it up and use it.
```html
<script type="text/template" id="myTemplate">
    myPartial {{key}}
</script>
```

### helpers.setVar `{{~setVar("name", content)}}`

This method allows you to set aside data for use somewhere within the template. This can help you achieve complex `if` `else` statements. It can also be useful for retaining information during loops.

Accessing set data as part a template tag.
```html
{{~setVar("foo", "myValue")}}
{{~var.foo}}
// myValue
```

Accessing set data within a JS expression.
```html
{{~setVar("foo", "myValue")}}
{{~exec(function() { return helpers.var.foo })}}
// myValue
```

Set aside a variable for use in `if`, `else`.
```html
{{#items}}
    {{~setVar("valid", data.published === true && (new Date()).getTime() > data.startdate.getTime())}}
    {{:~var.valid}}
        <div>{{title}}</div>
    {{/}}
    {{!~var.valid}}
        <div>Invalid</div>
    {{/}}
{{/items}}
```
JS
```js
var data = [
    { title : "Hotel 1", published : true, startdate : new Date(2011, 1, 1) },
    { title : "Hotel 2", published : false, startdate : new Date(2020, 1, 1) },
    { title : "Hotel 3", published : true, startdate : new Date(2020, 1, 1) },
    { title : "Hotel 4", published : true, startdate : new Date(2012, 1, 1) }
];
var result = goatee.fill(template, data);
```
Result. Hotels 2 and 3 are filtered out because they are `published` is `false` or their `startdate` is in the future.
```html
<div>Hotel 1</div>
<div>Invalid</div>
<div>Invalid</div>
<div>Hotel 4</div>
```

### helpers.stringify `{{~stringify(data.foo)}}`

Shorthand for `{{~exec(JSON.stringify(data.foo))}}`.

### helpers.fill `{{~fill(template, data, partials, global)}}`

This method allows you to execute a goatee fill within an existing template. This inception allows for the possibility of using dynamic named partials.

```html
{{+field}}
    <div>
        <span class="label">{{label}}</span>
        <span class="value">
            {{:valueTemplate}}{{~fill(helpers.partial(data.valueTemplate), data)}}{{?}}{{value}}{{/}}
        </span>
    </div>
{{/}}

{{+link}}
    <a href="{{value}}" target="{{target}}">{{value}}</a>
{{/}}

{{~setVar("fields", [
    { label : "Field 1", value : "value1" },
    { label : "Field 2", value : "http://www.google.com/", target="_blank", valueTemplate : "link" },
    { label : "Field 3", value : "value3" }
])}}

{{#~var.fields}}
    {{>field}}
{{/}}

<!-- result -->
    <div>
        <span class="label">Field 1</span>
        <span class="value">value1</span>
    </div>
    <div>
        <span class="label">Field 2</span>
        <span class="value"><a href="http://www.google.com/" target="_blank">http://www.google.com/</a></span>
    </div>
    <div>
        <span class="label">Field 3</span>
        <span class="value">value3</span>
    </div>
```
