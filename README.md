# Brifka

Brifka is simple version controll system that has:

-   **commiting** - taking snapshots of the current project state and saving it on the timeline,
-   **FTP client** - ability to connect to FTP server and download/upload files.

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

### Showing commands documentation

Show documentation of all commands or documentation of specific command if &lt;command_name&gt; was provided.

```
help
```

or

```
help <command_name>
```

### Adding files to tracked stage

Add all files from directory if &lt;directory_path&gt; was provided or single file if &lt;file_path&gt; was provided. If the directory has any paths included in the `.brignore` file, they will be skipped.

```
track <directory_path>
```

or

```
track <file_path>
```

### Removing files from tracked stage

Remove all files from directory if &lt;directory_path&gt; was provided or single file if &lt;file_path&gt; was provided.

```
untrack <directory_path>
```

or

```
untrack <file_path>
```

### Commiting

Take snapshot of current project state and save it on the timeline.

```
commit <commit_title>
```

### Removing commit

Remove last commit from timeline.

```
uncommit <commit_hash>
```

### Loading commit

Load state of chosen commit.

```
change <commit_hash>
```

### Showing all commits

Show list of all commits.

```
commmits
```

### Uploading repository to FTP server &lt;in development&gt;

Send repository to the FTP server specified in `brifka.config.json`. By default, entire repository memory will be sent along with the project, except for the configuration file, to the server. You can change that behavior in `brifka.config.json` and, for example, send only the project.

```
push
```

### Downloading repository from FTP server &lt;in development&gt;

Download repository from FTP server specified in `brifka.config.json`.

```
pull
```
