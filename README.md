# Brifka

Brifka is simple version controll system that has:

-   **commiting** - taking snapshots of the current project state and saving it on the timeline,
-   **FTP client** _`<under development>`_ - ability to connect to FTP server and download/upload files.
-   **Docker intergration** _`<under development>`_ - ability to run docker compose in order to test your services locally.

## Installation

```
npm install -g brifka
```

## Initialization

```
brifka init
```

## How to use

Initialize the repository using `init` command. Then write some initial code of your project and use `track <path>` command to add files to tracked stage. When you will be ready, use `commit <commit_title>` command and all files from tracked stage will be commited. You can check how many files are in tracked stage using `log` command, or check list of all not tracked and tracked files using `log full` command.

If you find that last commit had errors, you can remove it with the `uncommit` command. Also, if you think that your project has gone in wrong direction, you can use `change <commit_hash>` command to load state of chosen commit. To get hash of commit, you can use `commits` command. Commiting from commit that is not latest in the timeline will remove all newer commits.

## Commands

### `help`

```
brifka help [ | <command_name>]
```

#### Description

Show documentation of all commands or documentation of specific command if `command_name` was provided.

### `track`

```
brifka track [<file_path> | <directory_path>]
```

Add all files from directory if `<directory_path>` was provided or single file if `<file_path>` was provided. If the directory has any paths included in the `.brignore` file, they will be skipped.

### `untrack`

```
brifka untrack [<file_path> | <directory_path>]
```

#### Description

Remove all files from directory if `directory_path` was provided or single file if `file_path` was provided.

### `commit`

```
brifka commit [<commit_title>]
```

#### Description

Take snapshot of current project state and save it on the timeline.

### `uncommit`

```
brifka uncommit [<commit_hash>]
```

#### Description

Remove last commit from timeline.

### `change`

```
brifka change [<commit_hash>]
```

#### Description

Load state of chosen commit.

### `commits`

```
brifka commmits
```

#### Description

Show list of all commits.

### FTP

### `ftp list`

```
brifka ftp list [ | <ftp_directory>]
```

#### Description

Lists all files and directories from `<ftp_directory>`, or when not provided, from root directory specified in `brifka.config.json`.

### `ftp push` _`<under development>`_

```
brifka ftp push
```

#### Description

Send repository to the FTP server specified in `brifka.config.json`. By default, entire repository memory will be sent along with the state of that commit to the server. You can change that behavior in `brifka.config.json` and, for example, send only the state of last commit.

### `ftp pull` _`<under development>`_

```
brifka ftp pull
```

#### Description

Download repository from FTP server specified in `brifka.config.json`.

### Docker _`under development`_
