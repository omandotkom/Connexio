# connexio-shell-integration (PowerShell)
# Sets UTF-8 encoding and sources user profile.

if ($global:__CONNEXIO_HOOKS_LOADED) { return }
$global:__CONNEXIO_HOOKS_LOADED = $true

# Force UTF-8 encoding so Nerd Font / Unicode glyphs render correctly
try {
    [Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $global:OutputEncoding    = [System.Text.UTF8Encoding]::new($false)
} catch {}

# Source user's normal profile (oh-my-posh, starship, aliases, etc.)
$userProfile = [System.IO.Path]::Combine(
    [Environment]::GetFolderPath('MyDocuments'),
    'PowerShell', 'Microsoft.PowerShell_profile.ps1'
)
if (Test-Path $userProfile) {
    . $userProfile
} else {
    # Fallback: Windows PowerShell 5.1 profile location
    $userProfile5 = [System.IO.Path]::Combine(
        [Environment]::GetFolderPath('MyDocuments'),
        'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'
    )
    if (Test-Path $userProfile5) {
        . $userProfile5
    }
}
