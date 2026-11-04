param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Voice = 'Microsoft Zira Desktop'
)

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $synth.SelectVoice($Voice) } catch { }
$synth.Rate = 0
$synth.Volume = 100
$synth.SetOutputToWaveFile($OutFile)
$text = [IO.File]::ReadAllText($TextFile)
$synth.Speak($text)
$synth.Dispose()
Write-Output "ok:$OutFile"
