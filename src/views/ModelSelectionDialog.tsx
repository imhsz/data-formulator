// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import '../scss/App.scss';

import { useDispatch, useSelector } from "react-redux";
import { 
    DataFormulatorState,
    dfActions,
    ModelConfig,
} from '../app/dfSlice'

import _ from 'lodash';

import {
    Button,
    Tooltip,
    Typography,
    IconButton,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogActions,
    Radio,
    TextField,
    TableContainer,
    TableHead,
    Table,
    TableCell,
    TableRow,
    TableBody,
    Autocomplete,
    CircularProgress,
    FormControl,
    Select,
    SelectChangeEvent,
    MenuItem,
    OutlinedInput,
    Paper,
} from '@mui/material';


import { styled } from '@mui/material/styles';

import SettingsIcon from '@mui/icons-material/Settings';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { getUrls } from '../app/utils';

// Add interface for app configuration
interface AppConfig {
    SHOW_KEYS_ENABLED: boolean;
}

export const ModelSelectionButton: React.FC<{}> = ({ }) => {

    const dispatch = useDispatch();
    const models = useSelector((state: DataFormulatorState) => state.models);
    const selectedModelId = useSelector((state: DataFormulatorState) => state.selectedModelId);
    const testedModels = useSelector((state: DataFormulatorState) => state.testedModels);

    const [modelDialogOpen, setModelDialogOpen] = useState<boolean>(false);
    const [showKeys, setShowKeys] = useState<boolean>(false);
    const [tempSelectedModelId, setTempSelectedModelId] = useState<string | undefined >(selectedModelId);
    const [providerModelOptions, setProviderModelOptions] = useState<{[key: string]: string[]}>({
        'openai': [],
        'azure': [],
        'anthropic': [],
        'gemini': [],
        'ollama': []
    });
    const [isLoadingModelOptions, setIsLoadingModelOptions] = useState<boolean>(false);
    const [appConfig, setAppConfig] = useState<AppConfig>({ SHOW_KEYS_ENABLED: true });

    // Fetch app configuration
    useEffect(() => {
        fetch(getUrls().APP_CONFIG)
            .then(response => response.json())
            .then(data => {
                setAppConfig(data);
            })
            .catch(error => {
                console.error("Failed to fetch app configuration:", error);
            });
    }, []);

    let updateModelStatus = (model: ModelConfig, status: 'ok' | 'error' | 'testing' | 'unknown', message: string) => {
        dispatch(dfActions.updateModelStatus({id: model.id, status, message}));
    }
    let getStatus = (id: string | undefined) => {
        return id != undefined ? (testedModels.find(t => (t.id == id))?.status || 'unknown') : 'unknown';
    }

    const [newEndpoint, setNewEndpoint] = useState<string>(""); // openai, azure, ollama etc
    const [newModel, setNewModel] = useState<string>("");
    const [newApiKey, setNewApiKey] = useState<string | undefined>(undefined);
    const [newApiBase, setNewApiBase] = useState<string | undefined>(undefined);
    const [newApiVersion, setNewApiVersion] = useState<string | undefined>(undefined);

    // Fetch available models from the API
    useEffect(() => {
        const fetchModelOptions = async () => {
            setIsLoadingModelOptions(true);
            try {
                const response = await fetch(getUrls().CHECK_AVAILABLE_MODELS);
                const data = await response.json();
                
                // Group models by provider
                const modelsByProvider: {[key: string]: string[]} = {
                    'openai': [],
                    'azure': [],
                    'anthropic': [],
                    'gemini': [],
                    'ollama': []
                };
                
                data.forEach((modelConfig: any) => {
                    const provider = modelConfig.endpoint;
                    const model = modelConfig.model;

                    if (provider && model && !modelsByProvider[provider]) {
                        modelsByProvider[provider] = [];
                    }
                    
                    if (provider && model && !modelsByProvider[provider].includes(model)) {
                        modelsByProvider[provider].push(model);
                    }
                });
                
                setProviderModelOptions(modelsByProvider);
                
            } catch (error) {
                console.error("Failed to fetch model options:", error);
            } 
            setIsLoadingModelOptions(false);
        };
        
        fetchModelOptions();
    }, []);

    useEffect(() => {
        if (newEndpoint == 'ollama') {
            if (!newApiBase) {
                setNewApiBase('http://localhost:11434');
            }
        }
        if (newEndpoint == "openai") {
            if (!newModel && providerModelOptions.openai.length > 0) {
                setNewModel(providerModelOptions.openai[0]);
            }
        }
        if (newEndpoint == "anthropic") {
            if (!newModel && providerModelOptions.anthropic.length > 0) {
                setNewModel(providerModelOptions.anthropic[0]);
            }
        }
    }, [newEndpoint, providerModelOptions]);

    let modelExists = models.some(m => 
        m.endpoint == newEndpoint && m.model == newModel && m.api_base == newApiBase 
        && m.api_key == newApiKey && m.api_version == newApiVersion);

    let testModel = (model: ModelConfig) => {
        updateModelStatus(model, 'testing', "");
        let message = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({
                model: model,
            }),
        };
        fetch(getUrls().TEST_MODEL, {...message })
            .then((response) => response.json())
            .then((data) => {
                let status = data["status"] || 'error';
                updateModelStatus(model, status, data["message"] || "");
            }).catch((error) => {
                updateModelStatus(model, 'error', error.message)
            });
    }

    let readyToTest = newModel && (newApiKey || newApiBase);

    let newModelEntry = <TableRow
        key={`new-model-entry`}
        sx={{ '&:last-child td, &:last-child th': { border: 0 }, padding: "6px 6px" }}
        onClick={(event) => {
            event.stopPropagation();
            setTempSelectedModelId(undefined);
        }}
    >
        <TableCell align="right">
            <Radio checked={tempSelectedModelId == undefined} name="radio-buttons" inputProps={{'aria-label': 'Select this model'}}/>
        </TableCell>
        <TableCell align="left">
            <Autocomplete
                freeSolo
                value={newEndpoint}
                onChange={(event: any, newValue: string | null) => {
                    setNewEndpoint(newValue || "");
                    if (newModel == "" && newValue == "openai" && providerModelOptions.openai.length > 0) {
                        setNewModel(providerModelOptions.openai[0]);
                    }
                    if (!newApiVersion && newValue == "azure") {
                        setNewApiVersion("2024-02-15");
                    }
                }}
                options={['openai', 'azure', 'ollama', 'anthropic', 'gemini']}
                renderOption={(props, option) => (
                    <Typography {...props} onClick={() => setNewEndpoint(option)} sx={{fontSize: "0.875rem"}} key={`endpoint-option-${option}`}>
                        {option}
                    </Typography>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder="provider"
                        InputProps={{
                            ...params.InputProps,
                            style: { fontSize: "0.875rem" }
                        }}
                        size="small"
                        onChange={(event: any) => setNewEndpoint(event.target.value)}
                    />
                )}
                ListboxProps={{
                    style: { padding: 0 }
                }}
                PaperComponent={({ children }) => (
                    <Paper>
                        <Typography sx={{ p: 1, color: 'gray', fontStyle: 'italic', fontSize: '0.75rem' }}>
                            examples
                        </Typography>
                        {children}
                    </Paper>
                )}
            />
        </TableCell>
        <TableCell align="left" >
            <TextField fullWidth size="small" type={showKeys ? "text" : "password"} 
                InputProps={{ style: { fontSize: "0.875rem" } }} 
                placeholder='leave blank if using keyless access'
                error={!(newEndpoint == "azure" || newEndpoint == "ollama" || newEndpoint == "") && !newApiKey}
                value={newApiKey}  onChange={(event: any) => { setNewApiKey(event.target.value); }} 
                autoComplete='off'
            />
        </TableCell>
        <TableCell align="left">
            <Autocomplete
                freeSolo
                onChange={(event: any, newValue: string | null) => { setNewModel(newValue || ""); }}
                value={newModel}
                options={newEndpoint && providerModelOptions[newEndpoint] ? providerModelOptions[newEndpoint] : []}
                loading={isLoadingModelOptions}
                loadingText={<Typography sx={{fontSize: "0.875rem"}}>loading...</Typography>}
                renderOption={(props, option) => (
                    <Typography {...props} onClick={() => setNewModel(option)} sx={{fontSize: "0.875rem"}} key={`model-option-${option}`}>
                        {option}
                    </Typography>
                )}
                renderInput={(params) => (
                    <TextField
                        error={newEndpoint != "" && !newModel}
                        {...params}
                        placeholder="model name"
                        InputProps={{ 
                            ...params.InputProps, 
                            style: { fontSize: "0.875rem" },
                            endAdornment: (
                                <>
                                    {isLoadingModelOptions ? <CircularProgress color="primary" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                        inputProps={{
                            ...params.inputProps,
                            'aria-label': 'Select or enter a model',
                        }}
                        size="small"
                        onChange={(event: any) => { setNewModel(event.target.value); }}
                    />
                )}
                ListboxProps={{
                    style: { padding: 0 }
                }}
                PaperComponent={({ children }) => (
                    <Paper>
                        {!isLoadingModelOptions && (
                            <Typography sx={{ p: 1, color: 'gray', fontStyle: 'italic', fontSize: 'small' }}>
                                examples
                            </Typography>
                        )}
                        {children}
                    </Paper>
                )}
            />
        </TableCell>
        <TableCell align="right">
            <TextField size="small" type="text" fullWidth
                placeholder="api_base"
                error={newEndpoint === "azure" && !newApiBase}
                InputProps={{ style: { fontSize: "0.875rem" } }}
                value={newApiBase}  
                onChange={(event: any) => { setNewApiBase(event.target.value); }} 
                autoComplete='off'
            />
        </TableCell>
        <TableCell align="right">
            <TextField size="small" type="text" fullWidth
                InputProps={{ style: { fontSize: "0.875rem" } }}
                value={newApiVersion}  onChange={(event: any) => { setNewApiVersion(event.target.value); }} 
                autoComplete='off'
                placeholder="api_version"
            />
        </TableCell>
        <TableCell align="right">
            <Tooltip title={modelExists ? "provider + model already exists" : "add and test model"}>
                <IconButton color={modelExists ? 'error' : 'primary'}
                    disabled={!readyToTest}
                    sx={{cursor: modelExists ? 'help' : 'pointer'}}
                    onClick={(event) => {
                        event.stopPropagation()

                        console.log("checkpont 1")

                        let endpoint = newEndpoint;

                        let id = `${endpoint}-${newModel}-${newApiKey}-${newApiBase}-${newApiVersion}`;

                        let model = {endpoint, model: newModel, api_key: newApiKey, api_base: newApiBase, api_version: newApiVersion, id: id};

                        dispatch(dfActions.addModel(model));
                        dispatch(dfActions.selectModel(id));
                        setTempSelectedModelId(id);

                        testModel(model); 
                        
                        setNewEndpoint("");
                        setNewModel("");
                        setNewApiKey(undefined);
                        setNewApiBase(undefined);
                        setNewApiVersion(undefined);
                    }}>
                    <AddCircleIcon />
                </IconButton>
            </Tooltip>
        </TableCell>
        <TableCell align="right">
            <Tooltip title={"清除"}>
                <IconButton 
                    onClick={(event) => {
                        event.stopPropagation()
                        setNewEndpoint("");
                        setNewModel("");
                        setNewApiKey(undefined);
                        setNewApiBase(undefined);
                        setNewApiVersion(undefined);
                    }}>
                    <ClearIcon />
                </IconButton>
            </Tooltip>
        </TableCell>

    </TableRow>

    let modelTable = <TableContainer>
        <Table sx={{ minWidth: 600, "& .MuiTableCell-root": { padding: "6px 6px" } }} size="small" >
            <TableHead >
                <TableRow>
                    <TableCell align="right"></TableCell>
                    <TableCell sx={{fontWeight: 'bold', width: '120px'}}>提供商</TableCell>
                    <TableCell sx={{fontWeight: 'bold', width: '240px'}}>API密钥</TableCell>
                    <TableCell sx={{fontWeight: 'bold', width: '120px'}} align="left">模型</TableCell>
                    <TableCell sx={{fontWeight: 'bold', width: '240px'}} align="left">API基础地址</TableCell>
                    <TableCell sx={{fontWeight: 'bold', width: '120px'}} align="left">API版本</TableCell>
                    <TableCell sx={{fontWeight: 'bold'}} align="right">状态</TableCell>
                    <TableCell sx={{fontWeight: 'bold'}} align="right">操作</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {models.map((model) => {
                    let isItemSelected = tempSelectedModelId != undefined && tempSelectedModelId == model.id;
                    let status =  getStatus(model.id);  
                    
                    let statusIcon = status  == "unknown" ? <HelpOutlineIcon color="warning" /> : ( status == 'testing' ? <CircularProgress size={24} />:
                            (status == "ok" ? <CheckCircleOutlineIcon color="success"/> : <ErrorOutlineIcon color="error"/> ))
                    
                    let message = "模型可以使用";
                    if (status == "unknown") {
                        message = "应用前请点击状态图标进行测试。";
                    } else if (status == "error") {
                        message = testedModels.find(t => t.id == model.id)?.message || "未知错误";
                    }

                    const borderStyle = ['error', 'unknown'].includes(status) ? '1px dashed text.secondary' : undefined;
                    const noBorderStyle = ['error', 'unknown'].includes(status) ? 'none' : undefined;

                    return (
                        <React.Fragment key={`model-row-${model.id}`}>
                        <TableRow
                            selected={isItemSelected}
                            onClick={() => { setTempSelectedModelId(model.id) }}
                            sx={{ cursor: 'pointer'}}
                        >
                            <TableCell align="right" sx={{ borderBottom: noBorderStyle }}>
                                <Radio checked={isItemSelected} name="radio-buttons" inputProps={{'aria-label': 'Select this model'}} />
                            </TableCell>
                            <TableCell align="left" sx={{ borderBottom: noBorderStyle }}>
                                {model.endpoint}
                            </TableCell>
                            <TableCell component="th" scope="row" sx={{ borderBottom: borderStyle }}>
                                {model.api_key  ? (showKeys ? 
                                    <Typography 
                                        sx={{ 
                                            maxWidth: '240px',
                                            wordBreak: 'break-all',
                                            whiteSpace: 'normal'
                                        }} 
                                        fontSize={10}
                                    >
                                        {model.api_key}
                                    </Typography> 
                                    : "************")
                                     : <Typography sx={{color: "text.secondary"}} fontSize='inherit'>N/A</Typography>
                                }
                            </TableCell>
                            <TableCell align="left" sx={{ borderBottom: borderStyle }}>
                                {model.model}
                            </TableCell>
                            <TableCell align="left" sx={{ borderBottom: borderStyle }}>
                                {model.api_base}
                            </TableCell>
                            <TableCell align="left" sx={{ borderBottom: borderStyle }}>
                                {model.api_version} 
                            </TableCell>
                            <TableCell sx={{fontWeight: 'bold', borderBottom: borderStyle}} align="right">
                                <Tooltip title={message}>
                                    <IconButton
                                        onClick ={() => { testModel(model)  }}
                                    >
                                        {statusIcon}
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ borderBottom: borderStyle }} align="right">
                                <Tooltip title="移除模型">
                                    <IconButton 
                                        onClick={()=>{
                                            dispatch(dfActions.removeModel(model.id));
                                            if ((tempSelectedModelId) 
                                                    && tempSelectedModelId == model.id) {
                                                if (models.length == 0) {
                                                    setTempSelectedModelId(undefined);
                                                } else {
                                                    let chosenModel = models[models.length - 1];
                                                    setTempSelectedModelId(chosenModel.id)
                                                }
                                            }
                                        }}>
                                        <ClearIcon/>
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                        {['error', 'unknown'].includes(status) && (
                            <TableRow 
                                selected={isItemSelected}
                                onClick={() => { setTempSelectedModelId(model.id) }}
                                sx={{ 
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                    },
                                }}
                            >
                                <TableCell colSpan={2} align="right" ></TableCell>
                                <TableCell colSpan={6}>
                                    <Typography variant="caption" color="#c82c2c">
                                        {message}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        </React.Fragment>
                    )
                })}
                {newModelEntry}
                <TableRow>
                    <TableCell colSpan={8} align="left" sx={{ '& .MuiTypography-root': { fontSize: "0.625rem" } }}>
                        <Typography>
                            模型配置基于LiteLLM，<a href="https://docs.litellm.ai/docs/" target="_blank" rel="noopener noreferrer">查看此处支持的端点/模型</a>。
                            如果使用与OpenAI API兼容的自定义提供商，请选择"openai"作为提供商。
                        </Typography>
                        <Typography>
                            代码生成能力有限的模型（例如llama3.2）可能经常无法派生新数据。
                        </Typography>
                    </TableCell>
                </TableRow>
                </TableBody>
            </Table>
    </TableContainer>

    return <>
        <Tooltip title="选择模型">
            <Button sx={{fontSize: "inherit", textTransform: "none"}} variant="text" color="primary" onClick={()=>{setModelDialogOpen(true)}}>
                {selectedModelId ? `模型: ${(models.find(m => m.id == selectedModelId) as any)?.model}` : '选择模型'}
            </Button>
        </Tooltip>
        <Dialog 
            maxWidth="lg" 
            open={modelDialogOpen}
            onClose={(event, reason) => {
                if (reason !== 'backdropClick') {
                    setModelDialogOpen(false);
                }
            }}
        >
            <DialogTitle sx={{display: "flex",  alignItems: "center"}}>选择模型</DialogTitle>
            <DialogContent >
                {modelTable}
            </DialogContent>
            <DialogActions>
                {appConfig.SHOW_KEYS_ENABLED && (
                    <Button sx={{marginRight: 'auto'}} endIcon={showKeys ? <VisibilityOffIcon /> : <VisibilityIcon />} onClick={()=>{
                        setShowKeys(!showKeys);}}>
                            {showKeys ? '隐藏' : '显示'}密钥
                    </Button>
                )}
                <Button disabled={getStatus(tempSelectedModelId) !== 'ok'} 
                    variant={(selectedModelId == tempSelectedModelId) ? 'text' : 'contained'}
                    onClick={()=>{
                        dispatch(dfActions.selectModel(tempSelectedModelId));
                        setModelDialogOpen(false);}}>应用模型</Button>
                <Button onClick={()=>{
                    setTempSelectedModelId(selectedModelId);
                    setModelDialogOpen(false);
                }}>取消</Button>
            </DialogActions>
        </Dialog>
    </>;
}
