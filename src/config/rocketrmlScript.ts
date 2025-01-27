import { ApplyTransformation } from "../Definitions.ts";
import getRmlTransformationScript from "./rmlScript.ts";
import { matrixToCsv } from "../utils/helpers.ts";
import parser from "rocketrml";
import { Parser, Writer } from "n3";

/**
 * Different from the other transformation script, as it is also used in the wizard to transform the data.
 */

/**
 * Applies the transformation using RocketRML
 * @param opts
 */
const applyTransformation: ApplyTransformation = async (opts) => {
  if (opts.type === "rml" && Array.isArray(opts.source)) {
    const rmlMappings = await getRmlTransformationScript(opts.config)
    const inputFiles={
      [opts.config.sourceFileName]: matrixToCsv(opts.source),
    };
    const options = {
      toRDF: true,
      verbose: false,
      xmlPerformanceMode: false,
      replace: false,
    };
    let result = await parser.parseFileLive(rmlMappings.toString(), inputFiles, options).catch((err) => { console.log(err); });
    // Convert ntriples to turtle
    const rdfParser = new Parser();
    // TODO: is it possible to get prefixes from getPrefixes() in the wizardAppConfig?
    const prefixes = {
      '': opts.config.baseIri,
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      schema: 'https://schema.org/',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dc: 'http://purl.org/dc/elements/1.1/',
      dcterms: 'http://purl.org/dc/terms/',
      owl: 'http://www.w3.org/2002/07/owl#',
      dcat: 'http://www.w3.org/ns/dcat#',
      pav: 'http://purl.org/pav/',
      prov: 'http://www.w3.org/ns/prov#',
    }
    const quads = rdfParser.parse(result, null, (prefix, namespace) => {
      prefixes[prefix] = namespace['id']
    })
    const serializer = new Writer({ format: 'Turtle', prefixes: prefixes });
    serializer.addQuads(quads);
    serializer.end((error, turtleData) => {
      if (!error) {
        result = turtleData
      }
    });
    return result
  } else {
    throw new Error("Not supported");
  }
};
export default applyTransformation;
