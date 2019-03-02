workflow "Build" {
  resolves = ["GitHub Action for Docker"]
  on = "watch"
}

action "GitHub Action for Docker" {
  uses = "docker://plugins/docker"
  args = "[\"build\", \"-t\", \"nest-aws-iot:latest\", \".\"]"
  secrets = ["docker_username", "docker_password"]
  env = {
    PLUGIN_TAG = "latest"
    DRONE_COMMIT_SHA = "$GITHUB_SHA"
  }
}
