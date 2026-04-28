$repos = Get-Content repos.txt
$project = "project"

if (!(Test-Path "$project\.git")) {
    cd $project
    git init
    git add .
    git commit -m "initial commit"
    cd ..
}

cd $project

Write-Host "Fetching repositories..."

$i=1
foreach ($repo in $repos) {

    $name="repo$i"

    if (-not (git remote | Select-String $name)) {
        git remote add $name $repo
    }

    git fetch $name

    $i++
}

Write-Host "Merging updates..."

foreach ($r in git remote) {

    try {
        git merge "$r/main" --allow-unrelated-histories -m "sync merge"
    } catch {}
}

Write-Host "Pushing to all repositories..."

foreach ($r in git remote) {
    git push $r main --force
}

Write-Host "SYNC COMPLETE"