$win1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8 = [System.Text.Encoding]::UTF8

function Decode-Mojibake($str) {
    $bytes = $win1252.GetBytes($str)
    return $utf8.GetString($bytes)
}

function Fix-File($path) {
    $content = [System.IO.File]::ReadAllText($path, $utf8)
    
    # Build lookup of all non-ASCII substrings and their fixed versions
    # Strategy: find all runs of non-ASCII characters and attempt to decode each
    $result = [System.Text.StringBuilder]::new()
    $i = 0
    $chars = $content.ToCharArray()
    $len = $chars.Length
    
    while ($i -lt $len) {
        $c = $chars[$i]
        $code = [int]$c
        
        # Is this char a non-ASCII that could be a mojibake start (>= 0x80)?
        if ($code -gt 0x7E) {
            # Collect the full run of non-ASCII + Windows-1252-ambiguous chars
            # We need to try decoding sequences of 2, 3, 4 chars that form valid emoji
            $runStart = $i
            $run = ""
            # Collect up to 12 consecutive non-ASCII characters (longest ZWJ sequence)
            while ($i -lt $len -and $i - $runStart -lt 20) {
                $cc = $chars[$i]
                $ccode = [int]$cc
                # Include ASCII chars that are Windows-1252 special (0x22, 0x27 are normal quotes)
                # But the encoded emoji bytes include chars in 0x80-0xFF range
                if ($ccode -gt 0x7E) {
                    $run += $cc
                    $i++
                } else {
                    break
                }
            }
            
            if ($run.Length -gt 0) {
                try {
                    $bytes = $win1252.GetBytes($run)
                    $decoded = $utf8.GetString($bytes)
                    # Sanity check: decoded should be shorter or equal length
                    $result.Append($decoded) | Out-Null
                } catch {
                    $result.Append($run) | Out-Null
                }
            }
        } else {
            $result.Append($c) | Out-Null
            $i++
        }
    }
    
    [System.IO.File]::WriteAllText($path, $result.ToString(), $utf8)
    Write-Output "Fixed: $path"
}

Fix-File "c:\Users\bunny\DEV\web develeopment\tasktracking\frontend\src\components\Analytics.jsx"
Fix-File "c:\Users\bunny\DEV\web develeopment\tasktracking\frontend\src\components\CategoryManager.jsx"
