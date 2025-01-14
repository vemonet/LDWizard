import React from "react";
import styles from "./style.scss";
import { Alert, AlertTitle, Button, Box, Typography, Stack, CircularProgress} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { useRecoilState, useSetRecoilState } from "recoil";
import { Parser, Store, DataFactory, Writer } from "n3";
import RMLGenerator from "@rmlio/yarrrml-parser/lib/rml-generator";
import { mappingSourceState, sourceState, matrixState, transformationConfigState } from "../../state/index.ts";
import config from "../../config/index.ts";

class EmptySpaceInRowError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmptySpaceInRowError";
  }
}

class EmptySpaceInColumnError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmptySpaceInColumnError";
  }
}

const exampleFile = config.exampleCsv
  ? new File([new Blob([config.exampleCsv], { type: "text/csv" })], "example.csv")
  : undefined;

interface Props { }
export const Step = 1;
const parseCSV: (input: File) => Promise<Papa.ParseResult<string[]>> = (input) => {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(input, {
      error: (e) => {
        reject(e);
      },
      worker: true,
      complete: (results) => {
        resolve(results);
      },
      skipEmptyLines: "greedy",
    });
  });
};
const Upload: React.FC<Props> = ({ }) => {
  const navigate = useNavigate();

  const [error, setError] = React.useState<string>();
  const [parsedSource, setParsedSource] = useRecoilState(matrixState);
  const [source, setSource] = useRecoilState(sourceState);
  const [mappingSource, setMappingSource] = useRecoilState(mappingSourceState);
  const [loading, setLoading] = React.useState(false);

  const setTransformationConfig = useSetRecoilState(transformationConfigState);
  const sourceText =
    (source && (typeof source === "string" ? "Input selected" : `Current file: ${source.name}`)) || "No file selected";
  const mappingSourceText =
    (mappingSource && (typeof mappingSource === "string" ? "Input selected" : `Mapping file: ${mappingSource.name}`)) || "No file selected";
  const handleCsvParse = (sourceFile: File) => {
    setLoading(true);
    setSource(sourceFile);
    setTransformationConfig((state) => {
      return { ...state, sourceFileName: sourceFile.name };
    });

    const validateCSV: (data: string[][]) => void = (data) => {
      const numColumns = data[0].filter(column => column !== ("" || " ")).length
      for (let i = 1; i < data.length; i++) {
        if (data[i].includes((" " || ""))){
          throw new EmptySpaceInRowError("Invalid CSV file format. The file includes row(s) without a value.")
        }
        if (data[i].length > numColumns){
          throw new EmptySpaceInColumnError("Invalid CSV file format. The file includes column(s) without a value.")
        }
      }
    };

    setError(undefined);
    parseCSV(sourceFile)
      .then((parseResults) => {
        const parsedData = parseResults.data;
        try {
          validateCSV(parsedData)
          setParsedSource(parseResults.data);
          setTransformationConfig((state) => {
            return {
              ...state,
              key: undefined,
              csvProps: {
                delimiter: parseResults.meta.delimiter,
              },
              columnConfiguration: parseResults.data[0].map((header) => {
                return { columnName: header };
              }),
            };
          });
          setLoading(false);
        }
        catch(e){
          console.error(e, typeof e)
          if(e instanceof EmptySpaceInRowError){
            setLoading(false);
            setError("Invalid CSV file format. The file includes row(s) without a value.")
          }
          if(e instanceof EmptySpaceInColumnError){
            setLoading(false);
            setError("Invalid CSV file format. The file includes column(s) without a header.")
          }
        }
      })
      .catch((e) => {
        setLoading(false);
        setError(e.message);
      });
  };


  // Parse the RML mappings file, and update the TransformationConfiguration accordingly
  const handleRmlParse = (sourceFile: File) => {
    setLoading(true);
    setMappingSource(sourceFile);
    setTransformationConfig((state) => {
      return { ...state };
    });
    setError(undefined);

    const { namedNode, blankNode } = DataFactory;
    const rdfType = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
    const rr = "http://www.w3.org/ns/r2rml#"
    const rml = "http://semweb.mmlab.be/ns/rml#"
    const regexExtractTemplate = /(.*?)\{(.*?)\}/
    // NOTE: Info about source file dont need to be extracted as a new source file is provided

    // First we parse the provided RML RDF file
    const parser = new Parser()
    const prefixes = {}
    sourceFile.text().then((rmlString) => {
      try {
        const store = new Store()
        if (sourceFile.name.endsWith(".yml") || sourceFile.name.endsWith(".yaml")) {
          // Handle when YARRRML file provided
          const rmlGen = new RMLGenerator();
          store.addQuads(rmlGen.convert(rmlString))
        } else {
          store.addQuads(
            parser.parse(rmlString, null, (prefix, namespace) => {
              prefixes[prefix] = namespace['id']
            })
          )
        }

        // Iterate RML RDF, and change the transformation config
        // Get the TriplesMap subject
        let triplesMapSubject = null
        for (const quad of store.match(null, rdfType, namedNode(`${rr}TriplesMap`))) {
          if (triplesMapSubject) {
            setError("More than 1 TriplesMap has been found in the RML mappings. The LDWizard currently only supports defining 1 TripleMap.");
            break;
          } else {
            triplesMapSubject = quad.subject
          }
        }

        // Get the SubjectMap (subMap, which col is used to generate the subject)
        let subjectMapValue = null
        for (const subjectMapQuad of store.match(triplesMapSubject, namedNode(`${rr}subjectMap`), null)) {
          for (const subMapTemplateQuad of store.match(subjectMapQuad.object, namedNode(`${rr}template`), null)) {
            subjectMapValue = subMapTemplateQuad.object.value;
          }
        }
        if (subjectMapValue) {
          const match = subjectMapValue.match(regexExtractTemplate);
          if (match) {
            const baseIri = match[1];
            const keyColumnName = match[2];
            setTransformationConfig((state) => {
              const keyIndex = state.columnConfiguration.findIndex(obj => obj.columnName === keyColumnName);
              if (keyIndex > -1) {
                return {
                  ...state,
                  baseIri: baseIri,
                  key: keyIndex
                };
              }
              return {
                ...state,
                baseIri: baseIri,
              };
            });
          }
        }

        // Iterate over TriplesMap predicate-object mappings (poMap)
        for (const poMapQuad of store.match(triplesMapSubject, namedNode(`${rr}predicateObjectMap`), null)) {
          const poMapSubject = poMapQuad.object

          // Get the predicate of the predicate-object mapping (can be rr:predicate or rr:predicateMap)
          let poMapPredicate = null
          for (const poMapPredicateQuad of store.match(poMapSubject, namedNode(`${rr}predicate`), null)) {
            poMapPredicate = poMapPredicateQuad.object.value
          }
          if (!poMapPredicate) {
            for (const poMapPredicateQuad of store.match(poMapSubject, namedNode(`${rr}predicateMap`), null)) {
              for (const poMapPredicateConstant of store.match(poMapPredicateQuad.object, namedNode(`${rr}constant`), null)) {
                poMapPredicate = poMapPredicateConstant.object.value
              }
            }
          }

          // Get the object of the predicate-object mapping
          let poMapObjectUri = null
          for (const poMapObjectQuad of store.match(poMapSubject, namedNode(`${rr}objectMap`), null)) {
            poMapObjectUri = poMapObjectQuad.object
          }
          let poMapObjectValue = null
          for (const poMapConstant of store.match(poMapObjectUri, namedNode(`${rr}constant`), null)) {
            poMapObjectValue = poMapConstant.object.value
          }
          if (!poMapObjectValue) {
            for (const poMapConstant of store.match(poMapObjectUri, namedNode(`${rml}reference`), null)) {
              poMapObjectValue = poMapConstant.object.value
            }
          }
          let isTemplate = false;
          if (!poMapObjectValue) {
            for (const poMapConstant of store.match(poMapObjectUri, namedNode(`${rr}template`), null)) {
              poMapObjectValue = poMapConstant.object.value
              isTemplate = true;
            }
          }

          // If the predicate is rdf:type we update the resourceClass
          if (poMapPredicate == rdfType.id) {
            setTransformationConfig((state) => {
              return {
                ...state,
                resourceClass: poMapObjectValue
              };
            });
          } else {
            // Handle predicates other than rdf:type
            setTransformationConfig((state) => {
              const columnConfig = [...state.columnConfiguration];
              if (isTemplate) {
                // Handle rr:template for IRI Prefix transformation
                const match = poMapObjectValue.match(regexExtractTemplate);
                const baseIri = match[1];
                const keyColumnName = match[2];
                const keyIndex = state.columnConfiguration.findIndex(obj => obj.columnName === keyColumnName);
                if (keyIndex > -1) {
                  columnConfig[keyIndex] = {
                    columnName: keyColumnName,
                    propertyIri: poMapPredicate,
                    columnRefinement: {
                      type: "to-iri",
                      label: "to-iri",
                      data: {
                        iriPrefix: baseIri
                      }
                    }
                  }
                }

              } else {
                // Handle rml:reference which match to a column directly
                const keyIndex = state.columnConfiguration.findIndex(obj => obj.columnName === poMapObjectValue);
                columnConfig[keyIndex] = {
                  columnName: poMapObjectValue,
                  propertyIri: poMapPredicate
                }
              }
              return {
                ...state,
                columnConfiguration: columnConfig,
              };
            });
          }
        }
        setLoading(false);
        navigate(`/${Step + 1}`);
      } catch(e) {
        console.error(e, typeof e)
        setLoading(false);
        setError(`Issue loading the RML mapping file: ${e.message}`)
      }
    })
    .catch((e) => {
      setLoading(false);
      setError(e.message);
    });
  };


  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length === 1) {
      const sourceFile = droppedFiles[0];
      handleCsvParse(sourceFile);
    } else {
      setError("You can only drop one file");
    }
  };

  return (
    <> {loading ? (
      <div className={styles.loading}>
        <Stack alignItems="center">
          <Typography variant="body1" gutterBottom>
            Loading your CSV file
          </Typography>
          <CircularProgress />
        </Stack>

      </div>
    ) : (
      <>
        <div className={styles.button}
        onDragOver={(e) => handleDragOver(e)}
        onDrop={(e) => handleDrop(e)}>
          <div className={styles.dragDropIndicator}>
            <Typography variant="body1" color="primary">
              Drag and Drop Here
            </Typography>
          </div>
          <Typography variant="body1" gutterBottom>
            {sourceText}
          </Typography>
          <input
            id="csv-upload"
            type="file"
            className={styles.input}
            onChange={(event) => {
              if (event.target.files && event.target.files.length === 1) {
                const sourceFile = event.target.files[0];
                handleCsvParse(sourceFile);
              }
              else {
                if (event.target.files && event.target.files.length > 0) {
                  setError("You can only upload one file")
                }
                else if (event.target.files && event.target.files.length <= 0) {
                  setError("No files selected")
                }
                else {
                  setError("Invalid CSV file format")
                }
              }
            }}
            accept="text/csv"
          />
          <label htmlFor="csv-upload">
            <Box textAlign='center'>
              <Button component="span" variant="contained" style={{textTransform: 'none'}} startIcon={<FontAwesomeIcon icon="upload" />}>
                Load Your CSV File
              </Button>
            </Box>
          </label>
          {exampleFile && (
            <Typography style={{ paddingTop: "1rem" }}>
              Or try it with an{" "}
              <a
                style={{ cursor: "pointer" }}
                onClick={() => {
                  handleCsvParse(exampleFile);
                }}
              >
                example CSV file
              </a>
            </Typography>
          )}
        </div>

        {source &&
          <>
            <Typography variant="body1" style={{ textAlign: "center", paddingTop: "2rem" }}>
              Optionally you can provide a RML (in turtle format), or YARRRML (in YAML format) mapping file to pre-load the mappings from, or click next
            </Typography>
            <div className={styles.button}
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => handleDrop(e)}>
              <div className={styles.dragDropIndicator}>
                <Typography variant="body1" color="primary">
                  Drag and Drop Here
                </Typography>
              </div>
              <Typography variant="body1" gutterBottom>
                {mappingSourceText}
              </Typography>
              <input
                id="rml-upload"
                type="file"
                className={styles.input}
                onChange={(event) => {
                  if (event.target.files && event.target.files.length === 1) {
                    const sourceFile = event.target.files[0];
                    handleRmlParse(sourceFile);
                  }
                  else {
                    if (event.target.files && event.target.files.length > 0) {
                      setError("You can only upload one file")
                    }
                    else if (event.target.files && event.target.files.length <= 0) {
                      setError("No files selected")
                    }
                    else {
                      setError("Invalid RML file format")
                    }
                  }
                }}
                accept="text/turtle"
              />
              <label htmlFor="rml-upload">
                <Box textAlign='center'>
                  <Button component="span" variant="contained" style={{textTransform: 'none'}} startIcon={<FontAwesomeIcon icon="upload" />}>
                    Load your mapping file
                  </Button>
                </Box>
              </label>
            </div>
          </>
        }
        {error &&
          <div className={styles.button} style={{ marginTop: "1rem" }}>
            <Alert severity="error">
              <AlertTitle>Error</AlertTitle>{error}
            </Alert>
          </div>
        }
      </>
      )}
      <Box>
        <Button disabled className={styles.actionButtons} style={{textTransform: 'none'}}>
          Back
        </Button>
        <Button
          className={styles.actionButtons}
          variant="contained"
          color="primary"
          disabled={!parsedSource}
          onClick={() => navigate(`/${Step + 1}`)}
          style={{textTransform: 'none'}}
        >
          Next
        </Button>
        <Button
          className={styles.actionButtons}
          disabled={!parsedSource}
          onClick={() => {
            if (confirm("All progress will be lost, are you sure?")) {
              window.location.replace("");
            }
          }}
          style={{textTransform: 'none'}}
        >
          Restart
        </Button>
      </Box>
    </>
  );
};
export default Upload;