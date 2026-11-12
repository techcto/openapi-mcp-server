#!/usr/bin/env python3
"""Preserve the seller repository policy and grant SpaceMade read-only image pulls."""
import copy
import json
import subprocess

REPOSITORY = 'solodev/openapi-mcp'
REGISTRY = '709825985650'
STATEMENT = {
    'Sid': 'SpaceMadePublisherImagePull',
    'Effect': 'Allow',
    'Principal': {'AWS': 'arn:aws:iam::317530278439:root'},
    'Action': ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchCheckLayerAvailability'],
}

def policy_with_cloud_pull(policy):
    result = copy.deepcopy(policy)
    result.setdefault('Version', '2012-10-17')
    statements = result.setdefault('Statement', [])
    if not isinstance(statements, list):
        raise ValueError('Unexpected repository policy shape')
    result['Statement'] = [s for s in statements if s.get('Sid') != STATEMENT['Sid']] + [copy.deepcopy(STATEMENT)]
    return result

def main():
    command = ['aws', 'ecr']
    options = ['--region', 'us-east-1', '--registry-id', REGISTRY, '--output', 'json', '--no-cli-pager']
    result = subprocess.run(command + ['get-repository-policy', '--repository-name', REPOSITORY] + options, capture_output=True, text=True)
    if result.returncode:
        if 'RepositoryPolicyNotFoundException' not in result.stderr:
            raise SystemExit('Cannot read the existing repository policy; leaving it unchanged.')
        policy = {}
    else:
        policy = json.loads(json.loads(result.stdout)['policyText'])
    updated = policy_with_cloud_pull(policy)
    if updated != policy:
        subprocess.run(command + ['set-repository-policy', '--repository-name', REPOSITORY, '--policy-text', json.dumps(updated)] + options, check=True, stdout=subprocess.DEVNULL)
    print('SpaceMade read-only pull grant is configured; existing repository statements are preserved.')

if __name__ == '__main__':
    main()
