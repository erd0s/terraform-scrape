import * as fs from "fs";
import * as marked from "marked";
import * as cheerio from "cheerio";
import * as _ from "lodash";

// ================================== INTERFACES ==================================

interface ArgumentNodes {
    argumentNodes: Cheerio[]
}

interface AttributeNodes {
    attributeNodes: Cheerio[]
}

interface Resource {
    name: string;
    args: Variable[];
    attrs: Variable[];
}

interface Variable {
    name: string;
    description: string;
}

// ================================== FUNCTIONS ==================================

function getParsed(filename: string): Promise<CheerioStatic> {
    return new Promise((resolve, reject) => {
        var file = fs.readFileSync("terraform-provider-aws/website/docs/r/" + filename) + "";
        marked(file, (err, result) => {
            if (err) {
                return reject(err);
            }
            var $ = cheerio.load(result);
            resolve($);            
        });
    });
}

function getAllParsed(files: string[]): Promise<CheerioStatic>[] {
    return _.map(files, file => {
        return getParsed(file);
    });
}

function getNumWithArgumentReference($s: CheerioStatic[]): number {
    var result = _.map($s, $ => {
        return $("h2").filter((z, el) => {
            return $(el).text() == "Argument Reference";
        }).length;
    });
    return result.length;
}

function getNumWithAttributesReference($s: CheerioStatic[]): number {
    var result = _.map($s, $ => {
        return $("h2").filter((z, el) => {
            return $(el).text() == "Attributes Reference";
        }).length;
    });
    return result.length;
}

/**
 * Returns a list of nodes that follow the "Arguments Reference" h2
 * 
 * @param {*} $ - The full page as a cheerio object
 */
function extractArgumentsContent($: CheerioStatic): ArgumentNodes {
    var argsH2 = $("h2").filter((z, el) => {
        return $(el).text() == "Argument Reference";
    });
    if (argsH2.length != 1) {
        throw "Didn't find correct number of h2 > Arguments Reference";
    }
    var nodes = [];
    var currentNode:any = argsH2[0];
    while (true) {
        if (!(currentNode.type == "text" && currentNode["data"] == "\n")) {
            nodes.push(currentNode);
        }
        var nextSibling = _.get(currentNode, "nextSibling");
        if (!nextSibling || _.get(nextSibling, "name") == "h2") {
            break;
        }
        currentNode = _.get(currentNode, "nextSibling");
    }
    return {argumentNodes: nodes};
}

function extractAttributesContent($: CheerioStatic): AttributeNodes {
    var argsH2 = $("h2").filter((z, el) => {
        return $(el).text() == "Attribute Reference" || $(el).text() == "Attributes Reference";
    });
    if (argsH2.length != 1) {
        console.error(`Didn't find any attributes on ${extractResourceName($)}`);
        return {attributeNodes: []};
        // throw `Didn't find correct number of h2 > Attributes Reference on ${extractResourceName($)}`;
    }
    var nodes = [];
    var currentNode:any = argsH2[0];
    while (true) {
        if (!(currentNode.type == "text" && currentNode["data"] == "\n")) {
            nodes.push(currentNode);
        }
        var nextSibling = _.get(currentNode, "nextSibling");
        if (!nextSibling || _.get(nextSibling, "name") == "h2") {
            break;
        }
        currentNode = _.get(currentNode, "nextSibling");
    }
    return {attributeNodes: nodes};
}

function extractArguments(argNodes: ArgumentNodes, $: CheerioStatic): Variable[] {
    let nodes = argNodes.argumentNodes;
    
    // Find the first ul
    var firstUl = _.find(nodes, (o:any) => o.name == "ul");
    if (!firstUl) throw "Didn't find a UL when searching through arguments";
    return _.map($(firstUl).find("li"), li => {
        let text = $(li).text();
        let regex = /([a-zA-Z0-9_]+) (.+)/;
        let result = text.match(regex);
        var name, description;
        if (!result) {
            name = text;
            console.error(`Didn't find a description for ${text} on ${extractResourceName($)}`);
        }
        else {
            name = result[1];
            description = result[2];
        }
        return { name, description }
    });
}

function extractAttributes(argNodes: AttributeNodes, $: CheerioStatic): Variable[] {
    if (argNodes.attributeNodes.length == 0) return [];

    let nodes = argNodes.attributeNodes;
    
    // Find the first ul
    var firstUl = _.find(nodes, (o:any) => o.name == "ul");
    if (!firstUl) { 
        console.error(`Didn't find a UL when searching through attributes on ${extractResourceName($)}`);
    }
    return _.map($(firstUl).find("li"), li => {
        let text = $(li).text();
        let regex = /([a-zA-Z0-9_]+) (.+)/;
        let result = text.match(regex);
        var name, description;
        if (!result) {
            name = text;
            console.error(`Didn't find a description for ${text} on ${extractResourceName($)}`);
        }
        else {
            name = result[1];
            description = result[2];
        }
        return { name, description }
    });
}

function extractResourceName($: CheerioStatic): string {
    let name = $("h1").text();
    if (!name) throw "Couldn't extract name";
    return name;
}

// ================================== CODE ==================================

var files = fs.readdirSync("terraform-provider-aws/website/docs/r");
Promise.all(getAllParsed(files)).then($s => {
    var resources: Resource[] = _.map($s, $ => {
        return {
            name: extractResourceName($),
            args: extractArguments(extractArgumentsContent($), $),
            attrs: extractAttributes(extractAttributesContent($), $)
        }
    });
    let transformed = _.transform(resources, (result, value, key) => {
        result[value.name] = {
            args: value.args,
            attrs: value.attrs
        }
    }, {});

    console.log(JSON.stringify(transformed));
});