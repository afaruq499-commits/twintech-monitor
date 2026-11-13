$base = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp'
Set-ItemProperty -Path $base -Name Enabled -Value 1
Set-ItemProperty -Path "$base\IPAll" -Name TcpPort -Value '1433'
Set-ItemProperty -Path "$base\IPAll" -Name TcpDynamicPorts -Value ''
Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force
"OK" | Out-File "$PSScriptRoot\enable_tcp.done"
