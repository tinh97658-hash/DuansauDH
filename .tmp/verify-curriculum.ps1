$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

$map = @{}
Get-Content $envPath | Where-Object { $_ -match '^(ADMIN_EMAIL|ADMIN_PASSWORD)=' } | ForEach-Object {
  $kv = $_ -split '=', 2
  $map[$kv[0]] = $kv[1]
}

$base = "http://localhost:3001"
$sess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ email = $map['ADMIN_EMAIL']; password = $map['ADMIN_PASSWORD'] } | ConvertTo-Json
Invoke-WebRequest -Uri "$base/user/login" -Method Post -ContentType "application/json" -Body $loginBody -WebSession $sess -UseBasicParsing | Out-Null

$classes = Invoke-RestMethod -Uri "$base/plan/classes?program=masters&year=2026" -WebSession $sess
$classId = ($classes | Where-Object { $_.code -eq 'THS-K32-N01' }).id
Write-Host "Lop: THS-K32-N01 ($classId)"

function Get-State {
  (Invoke-WebRequest -Uri "$base/plan/classes/$classId/subjects" -WebSession $sess -UseBasicParsing).Content | ConvertFrom-Json
}

function Send-Subjects($state, $requiredId, $requiredValue) {
  $entries = @()
  foreach ($row in $state.subjects) {
    $value = [bool]$row.isRequired
    if ($row.id -eq $requiredId) { $value = $requiredValue }
    $entries += @{ subjectId = $row.subjectId; blockCode = $row.blockCode; isRequired = $value; credits = $row.credits }
  }
  $body = @{ subjects = $entries } | ConvertTo-Json -Depth 5
  Invoke-WebRequest -Uri "$base/plan/curriculums/$($state.curriculum.id)/subjects" -Method Put -ContentType "application/json" -Body $body -WebSession $sess -UseBasicParsing | Out-Null
}

$s0 = Get-State
$target = $s0.subjects | Where-Object { $_.isRequired } | Select-Object -First 1
Write-Host "0) Goc: bat buoc $($s0.totals.requiredCredits) TC, tu chon cua lop $($s0.totals.selectedElectiveCredits) TC | target $($target.code)"

Send-Subjects $s0 $target.id $false
$s1 = Get-State
$moved = $s1.subjects | Where-Object { $_.id -eq $target.id }
Write-Host "1) Doi sang TU CHON -> isRequired=$($moved.isRequired) selected=$($moved.selected) | bat buoc $($s1.totals.requiredCredits) TC | id giu nguyen: $($moved.id -eq $target.id)"

$pickBody = @{ curriculumSubjectIds = @($s1.selectedElectiveIds) + $target.id } | ConvertTo-Json -Depth 5
Invoke-WebRequest -Uri "$base/plan/classes/$classId/electives" -Method Put -ContentType "application/json" -Body $pickBody -WebSession $sess -UseBasicParsing | Out-Null
$s2 = Get-State
$picked = $s2.subjects | Where-Object { $_.id -eq $target.id }
Write-Host "2) Chon cho CA LOP -> selected=$($picked.selected) | tu chon cua lop $($s2.totals.selectedElectiveCredits) TC"

Send-Subjects $s2 $target.id $true
$s3 = Get-State
$back = $s3.subjects | Where-Object { $_.id -eq $target.id }
Write-Host "3) Tra ve BAT BUOC -> isRequired=$($back.isRequired) selected=$($back.selected) | bat buoc $($s3.totals.requiredCredits) TC"
$same = ($s3.totals.requiredCredits -eq $s0.totals.requiredCredits) -and ($s3.totals.selectedElectiveCredits -eq $s0.totals.selectedElectiveCredits)
Write-Host "4) Khoi phuc dung trang thai goc: $same"
