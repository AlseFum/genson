#!/usr/bin/env python3
"""
Minimal CLI to run the GenSON runtime library against a JSON schema.
Usage:
  python3 cli.py --input example.json
"""

import argparse
import json
import os
import genson as rt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', default='example.json')
    args = parser.parse_args()
    input_path = args.input
    if not os.path.isabs(input_path):
        input_path = os.path.join(os.getcwd(), input_path)
    with open(input_path, 'r', encoding='utf-8') as f:
        schema = json.load(f)
    output = rt.evaluate(schema)
    print(str(output))


if __name__ == '__main__':
    main()


