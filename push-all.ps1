$repos = Get-Content ..\repos.txt

foreach ($repo in $repos) {

    Write-Host "Pushing to $repo"

    git push $repo main --force

}