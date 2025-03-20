// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import validator from 'validator';
import DOMPurify from 'dompurify';

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, 
         IconButton, Input, CircularProgress, LinearProgress, Paper, TextField, useTheme, 
         Card} from '@mui/material';
import { CustomReactTable } from './ReactTable';
import { DictTable } from "../components/ComponentType";

import DeleteIcon from '@mui/icons-material/Delete';
import { getUrls } from '../app/utils';
import { createTableFromFromObjectArray, createTableFromText, loadTextDataWrapper, loadBinaryDataWrapper } from '../data/utils';

import CloseIcon from '@mui/icons-material/Close';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoFixNormalIcon from '@mui/icons-material/AutoFixNormal';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CancelIcon from '@mui/icons-material/Cancel';

import ReactDiffViewer from 'react-diff-viewer'

import { DataFormulatorState, dfActions, dfSelectors, fetchFieldSemanticType } from '../app/dfSlice';
import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import { AppDispatch } from '../app/store';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

    return (
	    <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            style={{maxWidth: 'calc(100% - 120px)'}}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 2 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
  return {
	id: `vertical-tab-${index}`,
	'aria-controls': `vertical-tabpanel-${index}`,
  };
}


export interface TableChallenges {
    name: string;
    challenges: { text: string; difficulty: 'easy' | 'medium' | 'hard'; }[];
    table: DictTable;
}


export interface TableSelectionViewProps {
    tableChallenges: TableChallenges[];
    handleDeleteTable?: (index: number) => void;
    handleSelectTable: (tableChallenges: TableChallenges) => void;
    hideRowNum?: boolean;
}


export const TableSelectionView: React.FC<TableSelectionViewProps> = function TableSelectionView({ tableChallenges, handleDeleteTable, handleSelectTable, hideRowNum  }) {

    const [value, setValue] = React.useState(0);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    let tabTitiles : string[] = [];
    for (let i = 0; i < tableChallenges.length; i ++) {
        let k = 0;
        let title = tableChallenges[i].name;
        while (tabTitiles.includes(title)) {
            k = k + 1;
            title = `${title}_${k}`;
        }
        tabTitiles.push(title);
    }

    return (
        <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', maxHeight: 600 }} >
        <Tabs
            orientation="vertical"
            variant="scrollable"
            value={value}
            onChange={handleChange}
            aria-label="Vertical tabs example"
            sx={{ borderRight: 1, borderColor: 'divider', minWidth: 120 }}
        >
            {tabTitiles.map((title, i) => <Tab wrapped key={i} label={title} sx={{textTransform: "none", width: 120}} {...a11yProps(0)} />)}
        </Tabs>
        {tableChallenges.map((tc, i) => {
            let t = tc.table;
            let sampleRows = [...t.rows.slice(0,9), Object.fromEntries(t.names.map(n => [n, "..."]))];
            let colDefs = t.names.map(name => { return {
                id: name, label: name, minWidth: 60, align: undefined, format: (v: any) => v,
            }})
            
            let challengeView = <Box sx={{margin: "6px 0px"}}>
                <Typography variant="subtitle2" sx={{marginLeft: "6px", fontSize: 12}}>尝试使用此数据集解决以下数据可视化挑战：</Typography>
                {tc.challenges.map((c, j) => <Box key={j} sx={{display: 'flex', alignItems: 'flex-start', pl: 1}}>
                    <Typography sx={{fontSize: 11, color: c.difficulty === 'easy' ? 'success.main' : 
                                                        c.difficulty === 'medium' ? 'warning.main' : 
                                                        'error.main'}}>[{c.difficulty}] {c.text}</Typography>
                </Box>)}
            </Box>  

            let content = <Paper variant="outlined" key={t.names.join("-")} sx={{width: 800, maxWidth: '100%', padding: "0px", marginBottom: "8px"}}>
                <CustomReactTable rows={sampleRows} columnDefs={colDefs} rowsPerPageNum={-1} compact={false} />
                {challengeView}
            </Paper>

            return  <TabPanel 
                        key={i}
                        value={value} index={i} >
                        {content}
                        <Box width="100%" sx={{display: "flex"}}>
                            <Typography sx={{fontSize: 10, color: "text.secondary"}}>{Object.keys(t.rows[0]).length} columns{hideRowNum ? "" : ` ⨉ ${t.rows.length} rows`}</Typography>
                            <Box sx={{marginLeft: "auto"}} >
                                {handleDeleteTable == undefined ? "" : 
                                    <IconButton size="small" color="primary" sx={{marginRight: "12px"}}
                                        onClick={(event: React.MouseEvent<HTMLElement>) => { 
                                            handleDeleteTable(i);
                                            setValue(i - 1 < 0 ? 0 : i - 1);
                                        }}
                                    >
                                        <DeleteIcon fontSize="inherit"/>
                                    </IconButton>}
                                <Button size="small" variant="contained" 
                                        onClick={(event: React.MouseEvent<HTMLElement>) => {
                                            handleSelectTable(tc);
                                        }}>
                                    加载表格
                                </Button>
                            </Box>
                        </Box>
                    </TabPanel>
        })}
        </Box>
    );
}

export const TableSelectionDialog: React.FC<{ buttonElement: any }> = function TableSelectionDialog({ buttonElement }) {

    const [datasetPreviews, setDatasetPreviews] = React.useState<TableChallenges[]>([]);
    const [tableDialogOpen, setTableDialogOpen] = useState<boolean>(false);

    React.useEffect(() => {
        // Show a loading animation/message while loading
        fetch(`${getUrls().VEGA_DATASET_LIST}`)
            .then((response) => response.json())
            .then((result) => {
                let tableChallenges : TableChallenges[] = result.map((info: any) => {
                    let table = createTableFromFromObjectArray(info["name"], JSON.parse(info["snapshot"]), true)
                    return {table: table, challenges: info["challenges"], name: info["name"]}
                }).filter((t : TableChallenges | undefined) => t != undefined);
                setDatasetPreviews(tableChallenges);
            });
      // No variable dependencies means this would run only once after the first render
      }, []);

    let dispatch = useDispatch<AppDispatch>();

    return <>
        <Button sx={{fontSize: "inherit"}} onClick={() => {
            setTableDialogOpen(true);
        }}>
            {buttonElement}
        </Button>
        <Dialog key="sample-dataset-selection-dialog" onClose={() => {setTableDialogOpen(false)}} 
                open={tableDialogOpen}
                sx={{ '& .MuiDialog-paper': { maxWidth: '100%', maxHeight: 840, minWidth: 800 } }}
            >
                <DialogTitle sx={{display: "flex"}}>浏览示例数据集
                    <IconButton
                        sx={{marginLeft: "auto"}}
                        edge="start"
                        size="small"
                        color="inherit"
                        onClick={() => {setTableDialogOpen(false)}}
                        aria-label="close"
                    >
                        <CloseIcon fontSize="inherit"/>
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{overflowX: "hidden", padding: 0}} dividers>
                    <TableSelectionView tableChallenges={datasetPreviews} hideRowNum
                        handleDeleteTable={undefined}
                        handleSelectTable={(tableChallenges) => {
                            // request public datasets from the server
                        console.log(tableChallenges);
                        console.log(`${getUrls().VEGA_DATASET_REQUEST_PREFIX}${tableChallenges.table.id}`)
                        fetch(`${getUrls().VEGA_DATASET_REQUEST_PREFIX}${tableChallenges.table.id}`)
                            .then((response) => {
                                return response.text()
                            })
                            .then((text) => {         
                                let fullTable = createTableFromFromObjectArray(tableChallenges.table.id, JSON.parse(text), true);
                                if (fullTable) {
                                    dispatch(dfActions.loadTable(fullTable));
                                    dispatch(fetchFieldSemanticType(fullTable));
                                    dispatch(dfActions.addChallenges({
                                        tableId: tableChallenges.table.id,
                                        challenges: tableChallenges.challenges
                                    }));
                                } else {
                                    throw "";
                                }
                                setTableDialogOpen(false); 
                            })
                            .catch((error) => {
                                console.log(error)
                                dispatch(dfActions.addMessages({
                                    "timestamp": Date.now(),
                                    "type": "error",
                                    "value": `无法加载示例数据集 ${tableChallenges.table.id}，请稍后重试或上传您自己的数据。`
                                }));
                            })
                        }}/>
                </ DialogContent>
            </Dialog>
    </>
}


export interface TableUploadDialogProps {
    buttonElement: any;
    disabled: boolean;
}

const getUniqueTableName = (baseName: string, existingNames: Set<string>): string => {
    let uniqueName = baseName;
    let counter = 1;
    while (existingNames.has(uniqueName)) {
        uniqueName = `${baseName}_${counter}`;
        counter++;
    }
    return uniqueName;
};

export const TableUploadDialog: React.FC<TableUploadDialogProps> = ({ buttonElement, disabled }) => {
    const dispatch = useDispatch<AppDispatch>();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    const existingNames = new Set(existingTables.map(t => t.id));

    let handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;

        if (files) {
            for (let file of files) {
                const uniqueName = getUniqueTableName(file.name, existingNames);
                
                // Check if file is a text type (csv, tsv, json)
                if (file.type === 'text/csv' || 
                    file.type === 'text/tab-separated-values' || 
                    file.type === 'application/json' ||
                    file.name.endsWith('.csv') || 
                    file.name.endsWith('.tsv') || 
                    file.name.endsWith('.json')) {
                    
                    // Handle text files
                    file.text().then((text) => {
                        let table = loadTextDataWrapper(uniqueName, text, file.type);
                        if (table) {
                            dispatch(dfActions.loadTable(table));
                            dispatch(fetchFieldSemanticType(table));
                        }
                    });
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                           file.type === 'application/vnd.ms-excel' ||
                           file.name.endsWith('.xlsx') || 
                           file.name.endsWith('.xls')) {
                    // Handle Excel files
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const arrayBuffer = e.target?.result as ArrayBuffer;
                        if (arrayBuffer) {
                            let tables = loadBinaryDataWrapper(uniqueName, arrayBuffer);
                            for (let table of tables) {
                                dispatch(dfActions.loadTable(table));
                                dispatch(fetchFieldSemanticType(table));
                            }
                            if (tables.length == 0) {
                                dispatch(dfActions.addMessages({
                                    "timestamp": Date.now(),
                                    "type": "error",
                                    "value": `Failed to parse Excel file ${file.name}. Please check the file format.`
                                }));
                            }
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    // Unsupported file type
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "type": "error",
                        "value": `Unsupported file format: ${file.name}. Please use CSV, TSV, JSON, or Excel files.`
                    }));
                }
            }
        }
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <>
            <Input
                inputProps={{ 
                    accept: '.csv,.tsv,.json,.xlsx,.xls',
                    multiple: true,
                }}
                id="upload-data-file"
                type="file"
                sx={{ display: 'none' }}
                inputRef={inputRef}
                onChange={handleFileUpload}
            />
            <Button 
                sx={{fontSize: "inherit"}} 
                variant="text" 
                color="primary" 
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
            >
                {buttonElement}
            </Button>
        </>
    );
}


export interface TableCopyDialogProps {
    buttonElement: any;
    disabled: boolean;
}

export interface TableURLDialogProps {
    buttonElement: any;
    disabled: boolean;
}

export const TableURLDialog: React.FC<TableURLDialogProps> = ({ buttonElement, disabled }) => {

    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [tableURL, setTableURL] = useState<string>("");

    const dispatch = useDispatch<AppDispatch>();

    let handleSubmitContent = (): void => {

        let  parts = tableURL.split('/');

        // Get the last part of the URL, which should be the file name with extension
        const tableName = parts[parts.length - 1];

        fetch(tableURL)
        .then(res => res.text())
        .then(content => {
            let table : undefined | DictTable = undefined;
            try {
                let jsonContent = JSON.parse(content);
                table = createTableFromFromObjectArray(tableName || 'dataset', jsonContent, true);
            } catch (error) {
                table = createTableFromText(tableName || 'dataset', content);
            }

            if (table) {
                dispatch(dfActions.loadTable(table));
                dispatch(fetchFieldSemanticType(table));
            }        
        })
    };

    let hasValidSuffix = tableURL.endsWith('.csv') || tableURL.endsWith('.tsv') || tableURL.endsWith(".json");

    let dialog = <Dialog key="table-url-dialog" onClose={()=>{setDialogOpen(false)}} open={dialogOpen}
            sx={{ '& .MuiDialog-paper': { maxWidth: '80%', maxHeight: 800, minWidth: 800 } }} disableRestoreFocus
        >
            <DialogTitle  sx={{display: "flex"}}>上传数据URL
                <IconButton
                    sx={{marginLeft: "auto"}}
                    edge="start"
                    size="small"
                    color="inherit"
                    onClick={()=>{ setDialogOpen(false); }}
                    aria-label="close"
                >
                    <CloseIcon fontSize="inherit"/>
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{overflowX: "hidden", padding: 2, display: "flex", flexDirection: "column"}} dividers>
                <TextField error={tableURL != "" && !hasValidSuffix} autoFocus placeholder='请输入数据集的URL' 
                            helperText={hasValidSuffix ? "" : "URL应链接到csv、tsv或json文件"}
                            sx={{marginBottom: 1}} size="small" value={tableURL} onChange={(event) => { setTableURL(event.target.value.trim()); }} 
                            id="dataset-url" label="数据URL" variant="outlined" />
            </ DialogContent>
            <DialogActions>
                <Button variant="contained" size="small" onClick={()=>{ setDialogOpen(false); }}>取消</Button>
                <Button variant="contained" size="small" onClick={()=>{ setDialogOpen(false); handleSubmitContent(); }} >
                    上传
                </Button>
            </DialogActions>
        </Dialog>;

    return <>
        <Button sx={{fontSize: "inherit"}} variant="text" color="primary" 
                    disabled={disabled} onClick={()=>{setDialogOpen(true)}}>
                {buttonElement}
        </Button>
        {dialog}
    </>;
}


export const TableCopyDialogV2: React.FC<TableCopyDialogProps> = ({ buttonElement, disabled }) => {

    let activeModel = useSelector(dfSelectors.getActiveModel);
    
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [tableName, setTableName] = useState<string>("");
    
    const [tableContent, setTableContent] = useState<string>("");
    const [imageCleaningInstr, setImageCleaningInstr] = useState<string>("");
    const [tableContentType, setTableContentType] = useState<'text' | 'image'>('text');

    const [cleaningInProgress, setCleaningInProgress] = useState<boolean>(false);
    const [cleanTableContent, setCleanTableContent] = useState<{content: string, reason: string, mode: string} | undefined>(undefined);

    let viewTable = cleanTableContent == undefined ?  undefined : createTableFromText(tableName || "clean-table", cleanTableContent.content)
 

    const [loadFromURL, setLoadFromURL] = useState<boolean>(false);
    const [url, setURL] = useState<string>("");

    let theme = useTheme()

    const dispatch = useDispatch<AppDispatch>();
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    const existingNames = new Set(existingTables.map(t => t.id));

    let handleSubmitContent = (tableStr: string): void => {
        let table: undefined | DictTable = undefined;
        
        // Generate a short unique name based on content and time if no name provided
        const defaultName = (() => {
            const hashStr = tableStr.substring(0, 100) + Date.now();
            const hashCode = hashStr.split('').reduce((acc, char) => {
                return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
            }, 0);
            const shortHash = Math.abs(hashCode).toString(36).substring(0, 4);
            return `data-${shortHash}`;
        })();

        const baseName = tableName || defaultName;
        const uniqueName = getUniqueTableName(baseName, existingNames);

        try {
            let content = JSON.parse(tableStr);
            table = createTableFromFromObjectArray(uniqueName, content, true);
        } catch (error) {
            table = createTableFromText(uniqueName, tableStr);
        }
        if (table) {
            dispatch(dfActions.loadTable(table));
            dispatch(fetchFieldSemanticType(table));
        }        
    };

    let handleLoadURL = () => {
        console.log("hello hello")
        setLoadFromURL(!loadFromURL);

        let  parts = url.split('/');

        // Get the last part of the URL, which should be the file name with extension
        const tableName = parts[parts.length - 1];

        fetch(url)
        .then(res => res.text())
        .then(content => {
            setTableName(tableName);
            setTableContent(content); 
            setTableContentType("text");
        })
    }

    let handleCleanData = () => {
        //setCleanTableContent("hehehao\n\n" + tableContent);
        let token = String(Date.now());
        setCleaningInProgress(true);
        setCleanTableContent(undefined);
        let message = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({
                token: token,
                content_type: tableContentType,
                raw_data: tableContent,
                image_cleaning_instruction: imageCleaningInstr,
                model: activeModel
            }),
        };

        fetch(getUrls().CLEAN_DATA_URL, message)
            .then((response) => response.json())
            .then((data) => {
                setCleaningInProgress(false);
                console.log(data);
                console.log(token);

                if (data["status"] == "ok") {
                    if (data["token"] == token) {
                        let candidate = data["result"][0];
                        console.log(candidate)

                        let cleanContent = candidate['content'];
                        let info = candidate['info'];

                        setCleanTableContent({content: cleanContent.trim(), reason: info['reason'], mode: info['mode']});
                        console.log(`data cleaning reason:`)
                        console.log(info);
                    }
                } else {
                    // TODO: add warnings to show the user
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "type": "error",
                        "value": "无法执行自动排序。"
                    }));
                    setCleanTableContent(undefined);
                }
            }).catch((error) => {
                setCleaningInProgress(false);
                setCleanTableContent(undefined);
               
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "type": "error",
                    "value": "由于服务器问题，无法执行数据清理。"
                }));
            });
    }

    const newStyles = {
        variables: { },
        line: {
            '&:hover': {
                background: alpha(theme.palette.primary.main, 0.2),
            },
        },
        titleBlock: {
            padding: '4px 8px',
            borderBottom: 'none'
        },
        marker: {
            width: 'fit-content'
        },
        content: {
            fontSize: 12,
            width: 'fit-content',
            maxWidth: "50%",
            minWidth: 300,
        },
        diffContainer: {
            "pre": { lineHeight: 1.2, fontFamily: 'sans-serif' }
        },
        contentText: {
            
        },
        gutter: {
            minWidth: '12px',
            fontSize: 12,
            padding: '0 8px',
        }
    };

    let renderLines = (str: string) => (
        <span style={{ }} >{str}</span>
    );

    let dialog = <Dialog key="table-selection-dialog" onClose={()=>{setDialogOpen(false)}} open={dialogOpen}
            sx={{ '& .MuiDialog-paper': { maxWidth: '80%', maxHeight: 800, minWidth: 800 } }}
        >
            <DialogTitle  sx={{display: "flex"}}>粘贴并上传数据
                <IconButton
                    sx={{marginLeft: "auto"}}
                    edge="start"
                    size="small"
                    color="inherit"
                    onClick={()=>{ setDialogOpen(false); }}
                    aria-label="close"
                >
                    <CloseIcon fontSize="inherit"/>
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{overflowX: "hidden", padding: 2, display: "flex", 
                                flexDirection: "column", 
                                "& .MuiOutlinedInput-root.Mui-disabled": {backgroundColor: 'rgba(0,0,0,0.05)'}}} dividers>
                <Box sx={{width: '100%', marginBottom: 1, display:'flex'}}>
                    <TextField sx={{flex: 1}} disabled={loadFromURL} size="small" 
                            value={tableName} onChange={(event) => { setTableName(event.target.value); }} 
                           autoComplete='off' id="outlined-basic" label="数据集名称" variant="outlined" />
                    <Divider sx={{margin: 1}} flexItem orientation='vertical'/>
                    <Button sx={{marginLeft: 0, textTransform: 'none'}} onClick={() => {setLoadFromURL(!loadFromURL)}} 
                            endIcon={!loadFromURL ? <ChevronLeftIcon/> : <ChevronRightIcon />} >{"从URL加载"}</Button>
                    <Collapse orientation='horizontal' in={loadFromURL}>
                        <Box component="form" sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }} >
                            <TextField sx={{width: 420}} size="small" value={url} 
                                onChange={(event) => { setURL(event.target.value); }} 
                                onKeyDown={(event)=> { 
                                    if(event.key == 'Enter'){
                                        handleLoadURL();
                                        event.preventDefault();
                                     }
                                }}
                                autoComplete='off' id="outlined-basic" label="网址" variant="outlined" />
                            <Button variant="contained" disabled={url == ""}  sx={{ p: '6px 0px', minWidth: '36px', marginLeft: 1, borderRadius: '32px' }}onClick={handleLoadURL} >
                                <KeyboardReturnIcon />
                            </Button>
                        </Box>
                    </Collapse>
                </Box>
                <Box sx={{width: '100%',  display:'flex', position: 'relative', overflow: 'auto'}}>
                    {cleaningInProgress && tableContentType == "text" ? <LinearProgress sx={{ width: '100%', height: "calc(100% - 8px)", marginTop: 1, minHeight: 200, opacity: 0.1, position: 'absolute', zIndex: 1 }} /> : ""}
                    {viewTable  ? 
                    <>
                        <CustomReactTable
                            rows={viewTable.rows} 
                            rowsPerPageNum={-1} compact={false}
                            columnDefs={viewTable.names.map(name => { 
                                return { id: name, label: name, minWidth: 60, align: undefined, format: (v: any) => v}
                            })}  
                        />
                        {/* <Typography>{cleanTableContent.reason}</Typography> */}
                    </>
                    : ( tableContentType == "text" ?
                        <TextField disabled={loadFromURL || cleaningInProgress} autoFocus 
                            size="small" sx={{ marginTop: 1, flex: 1, "& .MuiInputBase-input" : {fontSize: tableContent.length > 1000 ? 12 : 14, lineHeight: 1.2 }}} 
                            id="upload content" value={tableContent} maxRows={30}
                            onChange={(event) => { 
                                setTableContent(event.target.value); 
                            }}
                            InputLabelProps={{ shrink: true }}
                            placeholder="粘贴数据（CSV、TSV或JSON格式），或包含数据的文本片段/图像以开始。"
                            onPasteCapture={(e) => {
                                console.log(e.clipboardData.files);
                                if (e.clipboardData.files.length > 0) {
                                    let file = e.clipboardData.files[0];
                                    let read = new FileReader();

                                    read.readAsDataURL(file);

                                    read.onloadend = function(){
                                        let res = read.result;
                                        console.log(res);
                                        if (res) { 
                                            setTableContent(res as string); 
                                            setTableContentType("image");
                                        }
                                    }
                                }
                            }}
                            autoComplete='off'
                            label="数据内容" variant="outlined" multiline minRows={15} 
                        />
                        :
                        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                            <Box sx={{marginTop: 1, position: 'relative'}}>
                                {cleaningInProgress ? <LinearProgress sx={{ width: '100%', height: "calc(100% - 4px)", opacity: 0.1, position: 'absolute', zIndex: 1 }} /> : ""}
                                <IconButton size="small" color="primary"
                                            sx={{  backgroundColor: 'white', 
                                                width: 16, height: 16, boxShadow: 3, 
                                                position: 'absolute', right: 4, top: 4,
                                                "&:hover": { backgroundColor: "white", boxShadow: 8, transform: "translate(0.5px, -0.5px)"  }
                                                }}
                                    onClick={() => {
                                        setTableContent("");
                                        setTableContentType("text");
                                        setImageCleaningInstr("");
                                    }}
                                >
                                    <CancelIcon sx={{fontSize: 16}} />
                                </IconButton>
                                {validator.isURL(tableContent) || validator.isDataURI(tableContent) ? (
                                    <img style={{border: '1px lightgray solid', borderRadius: 4, maxWidth: 640, maxHeight: 360}} 
                                        src={DOMPurify.sanitize(tableContent)} alt="图像已损坏，请重试。" />
                                ) : (
                                    <Typography color="error">无效的图像数据</Typography>
                                )}
                            </Box>
                            <TextField fullWidth size="small" sx={{ marginTop: 1, "& .MuiInputBase-input" : {fontSize: 14, lineHeight: 1.2 }}} 
                                value={imageCleaningInstr} onChange={(event) => { setImageCleaningInstr(event.target.value); }} 
                                variant="standard" placeholder='额外的清理说明' />
                        </Box>)
                    }
                    </Box>
            </ DialogContent>
            <DialogActions>
                { cleanTableContent != undefined ? 
                    <Box sx={{display: 'flex', marginRight: 'auto'}}>
                        <Button sx={{}} variant="contained" color="warning" size="small" onClick={()=>{ setCleanTableContent(undefined); }} >
                            还原
                        </Button>
                        <Button sx={{marginLeft: 1}} variant="contained" size="small" 
                                onClick={()=>{ 
                                    setTableContent(cleanTableContent?.content || ""); 
                                    setTableContentType("text");
                                    setCleanTableContent(undefined); 
                                }} >
                            编辑数据
                        </Button>
                    </Box> : <Button disabled={tableContent.trim() == "" || loadFromURL} 
                    variant={cleaningInProgress ? "outlined" : "contained"} color="primary" size="small" sx={{marginRight: 'auto', textTransform: 'none'}} 
                        onClick={handleCleanData} endIcon={cleaningInProgress ? <CircularProgress size={24} /> : <AutoFixNormalIcon/> }>
                    {tableContentType == "text" ? "清理/生成数据" : "从图像提取数据"} {cleanTableContent ? "(再次)" : ""}
                </Button>}
                {/* <Collapse orientation='horizontal' in={cleanTableContent != undefined}>
                    <Divider sx={{marginLeft: 1}} flexItem orientation='vertical'/>
                </Collapse> */}
                <Button disabled={cleanTableContent != undefined} variant="contained" size="small" onClick={()=>{ setDialogOpen(false); }}>取消</Button>
                <Button disabled={cleanTableContent?.content == undefined && (tableContentType != "text" || tableContent.trim() == "")} variant="contained" size="small" 
                    onClick={()=>{ 
                        setDialogOpen(false); 
                        handleSubmitContent(cleanTableContent?.content || tableContent); 
                    }} >
                    {"上传"}
                </Button>
            </DialogActions>
            
        </Dialog>;

    return <>
        <Button sx={{fontSize: "inherit"}} variant="text" color="primary" 
                    disabled={disabled} onClick={()=>{setDialogOpen(true)}}>
                {buttonElement}
        </Button>
        {dialog}
    </>;
}
