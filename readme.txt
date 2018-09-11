prerequisites:

- set ssh-agent
- set 'app password' in bitbucket
- set ~/.backport/config.json:
{
  "accessToken": "<app-password>",

  "username": "<bitbucket-username>"
}

run:

./backport.exe

docs: https://github.com/sqren/backport