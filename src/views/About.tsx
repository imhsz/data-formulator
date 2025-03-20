// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Box, Typography, Button } from "@mui/material";
import React, { FC } from "react";

import dfLogo from '../assets/df-logo.png';
import { toolName } from "../app/App";

export const About: FC<{}> = function About({ }) {

    return (
        <Box sx={{display: "flex", flexDirection: "column", textAlign: "center", overflowY: "auto"}}>
            <Box sx={{display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: '40px'}}>
                <Box component="img" sx={{ paddingRight: "12px",  height: 64 }} alt="" src={dfLogo} />
                <Typography variant="h3">
                    {toolName}
                </Typography>
            </Box>
            <Box>
                <Button href="/" variant="outlined" sx={{margin: "20px 0"}}>
                    使用 {toolName}
                </Button>
            </Box>
            <Box sx={{textAlign: "initial", maxWidth: '80%',  margin: "auto", fontFamily: 'Arial,Roboto,Helvetica Neue,sans-serif'}}>
                <Typography>{toolName} 让您使用组合用户界面和自然语言描述创建并在丰富的可视化之间迭代。</Typography>
                <Typography>{toolName} 中的AI助手帮助您探索<em>超越初始数据集</em>的可视化效果。</Typography>
            </Box>
            <Box component="img" sx={{paddingTop: "20px",  height: 480, margin: "auto" }} alt="" src={"/data-formulator-screenshot.png"} />
        </Box>)
}