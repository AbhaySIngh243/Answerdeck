$ErrorActionPreference = 'Stop'
$targets = @{
  'peec' = 'https://peec.ai/'
  'profound' = 'https://www.tryprofound.com/'
  'answerrank' = 'https://answerrank.ai/'
  'rankscale' = 'https://rankscale.ai/'
  'rankinai' = 'https://rankinai.io/'
}

New-Item -ItemType Directory -Force -Path $PSScriptRoot | Out-Null
foreach ($name in $targets.Keys) {
  Invoke-WebRequest -Uri $targets[$name] -UseBasicParsing -TimeoutSec 45 -OutFile (Join-Path $PSScriptRoot "$name.html")
}

Invoke-WebRequest -Uri 'https://answerrank.ai/assets/index-Cjif5sJd.js' -UseBasicParsing -TimeoutSec 45 -OutFile (Join-Path $PSScriptRoot 'answerrank.js')
Invoke-WebRequest -Uri 'https://answerrank.ai/assets/index-BEr0XE4b.css' -UseBasicParsing -TimeoutSec 45 -OutFile (Join-Path $PSScriptRoot 'answerrank.css')
