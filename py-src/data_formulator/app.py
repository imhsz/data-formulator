# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

import argparse
import random
import sys
import os
import mimetypes
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')

import flask
from flask import Flask, request, send_from_directory, redirect, url_for
from flask import stream_with_context, Response
import html
import pandas as pd

import webbrowser
import threading

from flask_cors import CORS

import logging

import json
import time
from pathlib import Path
import traceback

from vega_datasets import data as vega_data

from data_formulator.agents.agent_concept_derive import ConceptDeriveAgent
from data_formulator.agents.agent_data_transform_v2 import DataTransformationAgentV2
from data_formulator.agents.agent_data_rec import DataRecAgent

from data_formulator.agents.agent_sort_data import SortDataAgent
from data_formulator.agents.agent_data_load import DataLoadAgent
from data_formulator.agents.agent_data_clean import DataCleanAgent
from data_formulator.agents.agent_code_explanation import CodeExplanationAgent

from data_formulator.agents.client_utils import Client

from dotenv import load_dotenv

APP_ROOT = Path(os.path.join(Path(__file__).parent)).absolute()

import os

app = Flask(__name__, static_url_path='', static_folder=os.path.join(APP_ROOT, "dist"))
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
    "expose_headers": ["Content-Type", "Authorization"],
    "supports_credentials": True,
    "max_age": 3600
}})

print(APP_ROOT)

# Load the single environment file
load_dotenv(os.path.join(APP_ROOT, "..", "..", 'api-keys.env'))
load_dotenv(os.path.join(APP_ROOT, 'api-keys.env'))
load_dotenv(os.path.join(APP_ROOT, '.env'))

# Configure root logger for general application logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Get logger for this module
logger = logging.getLogger(__name__)

# Configure Flask app logger to use the same settings
app.logger.handlers = []
for handler in logging.getLogger().handlers:
    app.logger.addHandler(handler)

# Example usage:
logger.info("Application level log")  # General application logging
app.logger.info("Flask specific log") # Web request related logging



def get_client(model_config):
    for key in model_config:
        model_config[key] = model_config[key].strip()

    client = Client(
        model_config["endpoint"],
        model_config["model"],
        model_config["api_key"] if "api_key" in model_config else None,
        html.escape(model_config["api_base"]) if "api_base" in model_config else None,
        model_config["api_version"] if "api_version" in model_config else None)

    return client

@app.route('/vega-datasets')
def get_example_dataset_list():
    print("正在尝试获取示例数据集列表...")
    try:
        # 定义我们确认能正常工作的数据集
        example_datasets = [
            {"name": "gapminder", "challenges": [
                {"text": "Create a line chart to show the life expectancy trend of each country over time.", "difficulty": "easy"},
                {"text": "Visualize the top 10 countries with highest life expectancy in 2005.", "difficulty": "medium"},
                {"text": "Find top 10 countries that have the biggest difference of life expectancy in 1955 and 2005.", "difficulty": "hard"},
                {"text": "Rank countries by their average population per decade. Then only show countries with population over 50 million in 2005.", "difficulty": "hard"}
            ]},
            {"name": "income", "challenges": [
                {"text": "Create a line chart to show the income trend of each state over time.", "difficulty": "easy"},
                {"text": "Only show washington and california's percentage of population in each income group each year.", "difficulty": "medium"},
                {"text": "Find the top 5 states with highest percentage of high income group in 2016.", "difficulty": "hard"}
            ]},
            {"name": "disasters", "challenges": [
                {"text": "Create a scatter plot to show the number of death from each disaster type each year.", "difficulty": "easy"},
                {"text": "Filter the data and show the number of death caused by flood or drought each year.", "difficulty": "easy"},
                {"text": "Create a heatmap to show the total number of death caused by each disaster type each decade.", "difficulty": "hard"},
                {"text": "Exclude 'all natural disasters' from the previous chart.", "difficulty": "medium"}
            ]},
            {"name": "movies", "challenges": [
                {"text": "Create a scatter plot to show the relationship between budget and worldwide gross.", "difficulty": "easy"},
                {"text": "Find the top 10 movies with highest profit after 2000 and visualize them in a bar chart.", "difficulty": "easy"},
                {"text": "Visualize the median profit ratio of movies in each genre", "difficulty": "medium"},
                {"text": "Create a scatter plot to show the relationship between profit and IMDB rating.", "difficulty": "medium"},
                {"text": "Turn the above plot into a heatmap by bucketing IMDB rating and profit, color tiles by the number of movies in each bucket.", "difficulty": "hard"}
            ]},
            {"name": "unemployment-across-industries", "challenges": [
                {"text": "Create a scatter plot to show the relationship between unemployment rate and year.", "difficulty": "easy"},
                {"text": "Create a line chart to show the average unemployment per year for each industry.", "difficulty": "medium"},
                {"text": "Find the 5 most stable industries (least change in unemployment rate between 2000 and 2010) and visualize their trend over time using line charts.", "difficulty": "medium"},
                {"text": "Create a bar chart to show the unemployment rate change between 2000 and 2010, and highlight the top 5 most stable industries with least change.", "difficulty": "hard"}
            ]}
        ]

        result = []
        print(f"处理预定义的{len(example_datasets)}个数据集")
        
        # 只处理我们预先定义的数据集，而不是所有vega_data.list_datasets()返回的数据集
        for dataset in example_datasets:
            try:
                name = dataset["name"]
                challenges = dataset["challenges"]
                
                print(f"处理数据集: {name}")
                info_obj = {'name': name, 'challenges': challenges, 'snapshot': vega_data(name).to_json(orient='records')}
                result.append(info_obj)
                print(f"成功处理数据集: {name}")
            except Exception as e:
                print(f"处理数据集 {name} 时出错: {str(e)}")
                traceback.print_exc()
                continue
        
        print(f"返回 {len(result)} 个数据集")
        response = flask.jsonify(result)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        error_msg = f"获取示例数据集时出错: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return json.dumps({"error": error_msg}), 500

@app.route('/vega-dataset/<path:path>')
def get_datasets(path):
    try:
        df = vega_data(path)
        # to_json is necessary for handle NaN issues
        data_object = df.to_json(None, 'records')
    except Exception as err:
        print(path)
        print(err)
        data_object = "[]"
    response = data_object
    return response

@app.route('/check-available-models', methods=['GET', 'POST'])
def check_available_models():
    results = []
    
    # Define configurations for different providers
    providers = ['openai', 'azure', 'anthropic', 'gemini', 'ollama']

    for provider in providers:
        # Skip if provider is not enabled
        if not os.getenv(f"{provider.upper()}_ENABLED", "").lower() == "true":
            continue
        
        api_key = os.getenv(f"{provider.upper()}_API_KEY", "")
        api_base = os.getenv(f"{provider.upper()}_API_BASE", "")
        api_version = os.getenv(f"{provider.upper()}_API_VERSION", "")
        models = os.getenv(f"{provider.upper()}_MODELS", "")

        if not (api_key or api_base):
            continue

        if not models:
            continue

        # Build config for each model
        for model in models.split(","):
            model = model.strip()
            if not model:
                continue

            model_config = {
                "id": f"{provider}-{model}-{api_key}-{api_base}-{api_version}",
                "endpoint": provider,
                "model": model,
                "api_key": api_key,
                "api_base": api_base,
                "api_version": api_version
            }
            
            try:
                client = get_client(model_config)
                response = client.get_completion(
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": "Respond 'I can hear you.' if you can hear me."},
                    ]
                )
                
                if "I can hear you." in response.choices[0].message.content:
                    results.append(model_config)
            except Exception as e:
                print(f"Error testing {provider} model {model}: {e}")
    
    response = flask.Response(json.dumps(results))
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    return response

@app.route('/test-model', methods=['GET', 'POST'])
def test_model():
    
    if request.is_json:
        app.logger.info("# code query: ")
        content = request.get_json()

        # contains endpoint, key, model, api_base, api_version
        logger.info("content------------------------------")
        logger.info(content)

        client = get_client(content['model'])

        try:
            response = client.get_completion(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Respond 'I can hear you.' if you can hear me. Do not say anything other than 'I can hear you.'"},
                ]
            )

            logger.info(f"model: {content['model']}")
            logger.info(f"welcome message: {response.choices[0].message.content}")

            if "I can hear you." in response.choices[0].message.content:
                result = {
                    "model": content['model'],
                    "status": 'ok',
                    "message": ""
                }
        except Exception as e:
            logger.info(f"Error: {e}")
            error_message = str(e)
            result = {
                "model": content['model'],
                "status": 'error',
                "message": error_message,
            }
    else:
        result = {'status': 'error'}
    
    return json.dumps(result)

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'OPTIONS'])
@app.route('/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
def catch_all(path):
    if request.method == 'OPTIONS':
        # 处理OPTIONS预检请求
        response = flask.Response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '3600')
        return response
    
    # 对于GET/POST请求，尝试返回静态文件
    if path == '':
        logger.info(app.static_folder)
        response = send_from_directory(app.static_folder, "index.html")
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '3600')
        return response
    
    # 尝试返回静态资源
    try:
        logger.info(f"Trying to serve static file: {path}")
        return send_from_directory(app.static_folder, path)
    except:
        # 如果没有匹配到文件，返回index.html (SPA处理)
        logger.info(f"File not found, returning index.html for: {path}")
        response = send_from_directory(app.static_folder, "index.html")
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '3600')
        return response

###### test functions ######

@app.route('/hello')
def hello():
    values = [
            {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
            {"a": "D", "b": 91}, {"a": "E", "b": 81}, {"a": "F", "b": 53},
            {"a": "G", "b": 19}, {"a": "H", "b": 87}, {"a": "I", "b": 52}
        ]
    spec =  {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "A simple bar chart with embedded data.",
        "data": { "values": values },
        "mark": "bar",
        "encoding": {
            "x": {"field": "a", "type": "nominal", "axis": {"labelAngle": 0}},
            "y": {"field": "b", "type": "quantitative"}
        }
    }
    return json.dumps(spec)


@app.route('/hello-stream')
def streamed_response():
    def generate():
        values = [
            {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
            {"a": "D", "b": 91}, {"a": "E", "b": 81}, {"a": "F", "b": 53},
            {"a": "G", "b": 19}, {"a": "H", "b": 87}, {"a": "I", "b": 52}
        ]
        spec =  {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "description": "A simple bar chart with embedded data.",
            "data": { "values": [] },
            "mark": "bar",
            "encoding": {
                "x": {"field": "a", "type": "nominal", "axis": {"labelAngle": 0}},
                "y": {"field": "b", "type": "quantitative"}
            }
        }
        for i in range(3):
            time.sleep(3)
            spec["data"]["values"] = values[i:]
            yield json.dumps(spec)
    return Response(stream_with_context(generate()))


###### agent related functions ######

@app.route('/process-data-on-load', methods=['GET', 'POST'])
def process_data_on_load_request():

    if request.is_json:
        app.logger.info("# process data query: ")
        content = request.get_json()
        token = content["token"]

        client = get_client(content['model'])

        app.logger.info(f" model: {content['model']}")
        
        agent = DataLoadAgent(client=client)
        candidates = agent.run(content["input_data"])
        
        candidates = [c['content'] for c in candidates if c['status'] == 'ok']

        response = flask.jsonify({ "status": "ok", "token": token, "result": candidates })
    else:
        response = flask.jsonify({ "token": -1, "status": "error", "result": [] })

    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/derive-concept-request', methods=['GET', 'POST'])
def derive_concept_request():

    if request.is_json:
        app.logger.info("# code query: ")
        content = request.get_json()
        token = content["token"]

        client = get_client(content['model'])

        app.logger.info(f" model: {content['model']}")
        agent = ConceptDeriveAgent(client=client)

        #print(content["input_data"])

        candidates = agent.run(content["input_data"], [f['name'] for f in content["input_fields"]], 
                                       content["output_name"], content["description"])
        
        candidates = [c['code'] for c in candidates if c['status'] == 'ok']

        response = flask.jsonify({ "status": "ok", "token": token, "result": candidates })
    else:
        response = flask.jsonify({ "token": -1, "status": "error", "result": [] })

    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/clean-data', methods=['GET', 'POST'])
def clean_data_request():

    if request.is_json:
        app.logger.info("# data clean request")
        content = request.get_json()
        token = content["token"]

        client = get_client(content['model'])

        app.logger.info(f" model: {content['model']}")
        
        agent = DataCleanAgent(client=client)

        candidates = agent.run(content['content_type'], content["raw_data"], content["image_cleaning_instruction"])
        
        candidates = [c for c in candidates if c['status'] == 'ok']

        response = flask.jsonify({ "status": "ok", "token": token, "result": candidates })
    else:
        response = flask.jsonify({ "token": -1, "status": "error", "result": [] })

    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/codex-sort-request', methods=['GET', 'POST'])
def sort_data_request():

    if request.is_json:
        app.logger.info("# sort query: ")
        content = request.get_json()
        token = content["token"]

        client = get_client(content['model'])

        agent = SortDataAgent(client=client)
        candidates = agent.run(content['field'], content['items'])

        #candidates, dialog = limbo_concept.call_codex_sort(content["items"], content["field"])
        candidates = candidates if candidates != None else []
        response = flask.jsonify({ "status": "ok", "token": token, "result": candidates })
    else:
        response = flask.jsonify({ "token": -1, "status": "error", "result": [] })

    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/derive-data', methods=['GET', 'POST'])
def derive_data():

    if request.is_json:
        app.logger.info("# request data: ")
        content = request.get_json()        
        token = content["token"]

        client = get_client(content['model'])

        # each table is a dict with {"name": xxx, "rows": [...]}
        input_tables = content["input_tables"]
        new_fields = content["new_fields"]
        instruction = content["extra_prompt"]

        max_repair_attempts = content["max_repair_attempts"] if "max_repair_attempts" in content else 1

        if "additional_messages" in content:
            prev_messages = content["additional_messages"]
        else:
            prev_messages = []

        logger.info("== input tables ===>")
        for table in input_tables:
            logger.info(f"===> Table: {table['name']} (first 5 rows)")
            logger.info(table['rows'][:5])

        logger.info("== user spec ===")
        logger.info(new_fields)
        logger.info(instruction)

        mode = "transform"
        if len(new_fields) == 0:
            mode = "recommendation"

        if mode == "recommendation":
            # now it's in recommendation mode
            agent = DataRecAgent(client=client)
            results = agent.run(input_tables, instruction)
        else:
            agent = DataTransformationAgentV2(client=client)
            results = agent.run(input_tables, instruction, [field['name'] for field in new_fields], prev_messages)

        repair_attempts = 0
        while results[0]['status'] == 'error' and repair_attempts < max_repair_attempts: # try up to n times
            error_message = results[0]['content']
            new_instruction = f"We run into the following problem executing the code, please fix it:\n\n{error_message}\n\nPlease think step by step, reflect why the error happens and fix the code so that no more errors would occur."

            prev_dialog = results[0]['dialog']

            if mode == "transform":
                results = agent.followup(input_tables, prev_dialog, [field['name'] for field in new_fields], new_instruction)
            if mode == "recommendation":
                results = agent.followup(input_tables, prev_dialog, new_instruction)

            repair_attempts += 1
        
        response = flask.jsonify({ "token": token, "status": "ok", "results": results })
    else:
        response = flask.jsonify({ "token": "", "status": "error", "results": [] })

    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/refine-data', methods=['GET', 'POST'])
def refine_data():

    if request.is_json:
        app.logger.info("# request data: ")
        content = request.get_json()        
        token = content["token"]

        client = get_client(content['model'])

        # each table is a dict with {"name": xxx, "rows": [...]}
        input_tables = content["input_tables"]
        output_fields = content["output_fields"]
        dialog = content["dialog"]
        new_instruction = content["new_instruction"]
        max_repair_attempts = content["max_repair_attempts"] if "max_repair_attempts" in content else 1
        
        logger.info("== input tables ===>")
        for table in input_tables:
            logger.info(f"===> Table: {table['name']} (first 5 rows)")
            logger.info(table['rows'][:5])
        
        logger.info("== user spec ===>")
        logger.info(output_fields)
        logger.info(new_instruction)

        # always resort to the data transform agent       
        agent = DataTransformationAgentV2(client=client)
        results = agent.followup(input_tables, dialog, [field['name'] for field in output_fields], new_instruction)

        repair_attempts = 0
        while results[0]['status'] == 'error' and repair_attempts < max_repair_attempts: # only try once
            error_message = results[0]['content']
            new_instruction = f"We run into the following problem executing the code, please fix it:\n\n{error_message}\n\nPlease think step by step, reflect why the error happens and fix the code so that no more errors would occur."
            prev_dialog = results[0]['dialog']

            results = agent.followup(input_tables, prev_dialog, [field['name'] for field in output_fields], new_instruction)
            repair_attempts += 1

        response = flask.jsonify({ "token": token, "status": "ok", "results": results})
    else:
        response = flask.jsonify({ "token": "", "status": "error", "results": []})

    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/code-expl', methods=['GET', 'POST'])
def request_code_expl():
    if request.is_json:
        app.logger.info("# request data: ")
        content = request.get_json()        
        token = content["token"]

        client = get_client(content['model'])

        # each table is a dict with {"name": xxx, "rows": [...]}
        input_tables = content["input_tables"]
        code = content["code"]
        
        code_expl_agent = CodeExplanationAgent(client=client)
        expl = code_expl_agent.run(input_tables, code)
    else:
        expl = ""
    return expl

@app.route('/app-config', methods=['GET', 'OPTIONS'])
def get_app_config():
    """Provide frontend configuration settings from environment variables"""
    if request.method == 'OPTIONS':
        response = flask.Response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '3600')
        return response
        
    config = {
        "SHOW_KEYS_ENABLED": os.getenv("SHOW_KEYS_ENABLED", "true").lower() == "true"
    }
    response = flask.jsonify(config)
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '3600')
    return response

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AI图表")
    parser.add_argument("-p", "--port", type=int, default=5656, help="The port number you want to use")
    return parser.parse_args()


def run_app():
    args = parse_args()

    url = "http://localhost:{0}".format(args.port)
    threading.Timer(2, lambda: webbrowser.open(url, new=2)).start()

    app.run(host='0.0.0.0', port=args.port, threaded=True)
    
if __name__ == '__main__':
    #app.run(debug=True, host='127.0.0.1', port=5000)
    #use 0.0.0.0 for public
    run_app()
