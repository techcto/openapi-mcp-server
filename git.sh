#!/bin/bash

args=("$@")

tag(){
    VERSION="${args[1]}"
    if [ -z "$VERSION" ]; then
        echo "Usage: ./git.sh tag <version>"
        return 1
    fi
    git tag -a "v${VERSION}" -m "release ${VERSION}"
    git push origin "v${VERSION}"
}

retag(){
    VERSION="${args[1]}"
    if [ -z "$VERSION" ]; then
        echo "Usage: ./git.sh retag <version>"
        return 1
    fi
    git tag -f -a "v${VERSION}" -m "release ${VERSION}"
    git push origin "v${VERSION}" --force
}

$*
