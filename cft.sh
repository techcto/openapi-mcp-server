#!/bin/bash

args=("$@")

STACK_NAME="${STACK_NAME:-openapi-mcp-test}"
TEMPLATE="devops/cloudformation/agentcore-runtime.yaml"

deploy(){
    local image_uri="${args[1]:-709825985650.dkr.ecr.us-east-1.amazonaws.com/solodev/openapi-mcp:0.0.2}"
    local openapi_url="${args[2]:-https://petstore.swagger.io/v2/swagger.json}"
    local api_base_url="${args[3]:-https://petstore.swagger.io/v2}"

    aws cloudformation validate-template --template-body "file://${TEMPLATE}" || return 1

    aws cloudformation deploy \
        --template-file "${TEMPLATE}" \
        --stack-name "${STACK_NAME}" \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ContainerImageUri="${image_uri}" \
            OpenApiUrl="${openapi_url}" \
            ApiBaseUrl="${api_base_url}"
}

events(){
    aws cloudformation describe-stack-events --stack-name "${STACK_NAME}" \
        --query "StackEvents[?LogicalResourceId=='AgentCoreRuntime']"
}

logs(){
    aws logs tail "/aws/lambda/${STACK_NAME}-provisioner" --since 30m
}

outputs(){
    aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
        --query 'Stacks[0].Outputs'
}

teardown(){
    aws cloudformation delete-stack --stack-name "${STACK_NAME}"
    aws cloudformation wait stack-delete-complete --stack-name "${STACK_NAME}"
}

$*
