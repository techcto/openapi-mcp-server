import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('pull_policy', Path(__file__).parents[1] / 'devops/allow-cloud-pulls.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PublisherPullPolicyTest(unittest.TestCase):
    def test_preserves_marketplace_policy_and_adds_only_scoped_pull_actions(self):
        original = {'Version': '2012-10-17', 'Statement': [{'Sid': 'Marketplace', 'Effect': 'Allow', 'Principal': {'Service': 'aws-marketplace.amazonaws.com'}, 'Action': ['ecr:BatchGetImage']}]}
        result = module.policy_with_cloud_pull(original)
        self.assertEqual(original['Statement'], result['Statement'][:1])
        self.assertEqual(result['Statement'][1]['Principal'], {'AWS': 'arn:aws:iam::317530278439:root'})
        self.assertEqual(set(result['Statement'][1]['Action']), {'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchCheckLayerAvailability'})
        self.assertEqual(result, module.policy_with_cloud_pull(result))
        self.assertEqual(len(original['Statement']), 1)

if __name__ == '__main__':
    unittest.main()
