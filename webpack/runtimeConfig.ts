/**
 * This file is a placeHolder to be used during development, or as reference by users.
 * It provides examples for every parameters of the LDWizard,
 * such as class/predicate search config, column refinements, allowed prefixes...
 */
globalThis.wizardConfig = {
  appName: "LDWizard - development",
  defaultBaseIri: "https://w3id.org/my-ldwizard/",
  homepageMarkdown: `Example LDWizard for development, a tool to easily map CSV to RDF.`,
  publishOrder: [ "download" as const ],
  newDatasetAccessLevel: "internal" as const,

  repositoryLink: "https://github.com/pldn/LDWizard",
  documentationLink: "https://github.com/pldn/LDWizard/blob/main/CONFIGURING.md",
  dataplatformLink: "https://lov.linkeddata.es/dataset/lov/sparql",

  classConfig: {
      method: "sparql" as const,
      endpoint: "https://lov.linkeddata.es/dataset/lov/sparql"
  },
  predicateConfig: {
      method:"sparql" as const,
      endpoint: "https://lov.linkeddata.es/dataset/lov/sparql"
  },

  columnRefinements: [
      {
          label: "Convert lang ISO to Lexvo URIs",
          type: "single" as const,
          description:
              "This transformation will take lang ISO (e.g. fr or fra) and convert it to a Lexvo URI: http://lexvo.org/id/iso639-3/eng",
          transformation: async (searchTerm: string) => {
              if (searchTerm.length == 3) {
                  return `http://lexvo.org/id/iso639-3/${searchTerm}`
              }
              if (searchTerm.length == 2) {
                  return `http://lexvo.org/id/iso639-1/${searchTerm}`
              }
              return ""
          },
      },
  ],

  getAllowedPrefixes: async () => {
      return [
          {
              "prefixLabel": "dc",
              "iri": "http://purl.org/dc/elements/1.1/"
          },
          {
              "prefixLabel": "dcat",
              "iri": "http://www.w3.org/ns/dcat#"
          },
          {
              "prefixLabel": "dct",
              "iri": "http://purl.org/dc/terms/"
          },
          {
              "prefixLabel": "fn",
              "iri": "http://www.w3.org/2005/xpath-functions#"
          },
          {
              "prefixLabel": "foaf",
              "iri": "http://xmlns.com/foaf/0.1/"
          },
          {
              "prefixLabel": "gr",
              "iri": "http://purl.org/goodrelations/v1#"
          },
          {
              "prefixLabel": "owl",
              "iri": "http://www.w3.org/2002/07/owl#"
          },
          {
              "prefixLabel": "prov",
              "iri": "http://www.w3.org/ns/prov#"
          },
          {
              "prefixLabel": "pav",
              "iri": "http://purl.org/pav/"
          },
          {
              "prefixLabel": "rdf",
              "iri": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          },
          {
              "prefixLabel": "rdfa",
              "iri": "http://www.w3.org/ns/rdfa#"
          },
          {
              "prefixLabel": "rdfs",
              "iri": "http://www.w3.org/2000/01/rdf-schema#"
          },
          {
              "prefixLabel": "schema",
              "iri": "https://schema.org/"
          },
          {
              "prefixLabel": "sioc",
              "iri": "http://rdfs.org/sioc/ns#"
          },
          {
              "prefixLabel": "skos",
              "iri": "http://www.w3.org/2004/02/skos/core#"
          },
          {
              "prefixLabel": "void",
              "iri": "http://rdfs.org/ns/void#"
          },
          {
              "prefixLabel": "xsd",
              "iri": "http://www.w3.org/2001/XMLSchema#"
          },
          {
              "prefixLabel": "sio",
              "iri": "http://semanticscience.org/resource/"
          },
          {
              "prefixLabel": "wd",
              "iri": "http://www.wikidata.org/entity/"
          },
      ]
  },

  // icon: logo,
  // favIcon: logo,
  // primaryColor: "#4caf50", // green
  // secondaryColor: "#1565c0", // blue
}
