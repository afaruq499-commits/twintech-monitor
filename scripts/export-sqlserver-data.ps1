# scripts/export-sqlserver-data.ps1
param(
    [string]$OutputDir = "$PSScriptRoot\..\scratch\sqlserver_export"
)

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$connStr = "Server=.\SQLEXPRESS;Database=ProjectMonitor;Integrated Security=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$tables = @(
    "settings",
    "catalog_components",
    "projects",
    "pr_imports",
    "components",
    "lanes",
    "work_items",
    "sub_scopes",
    "task_details",
    "schedule_cells",
    "work_item_components",
    "work_templates",
    "template_sub_scopes",
    "template_details",
    "alert_dismissals"
)

foreach ($table in $tables) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM [$table]"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dataTable = New-Object System.Data.DataTable
    $null = $adapter.Fill($dataTable)
    
    $rows = @()
    foreach ($row in $dataTable.Rows) {
        $dict = [ordered]@{}
        foreach ($col in $dataTable.Columns) {
            $val = $row[$col.ColumnName]
            if ($val -eq [DBNull]::Value) {
                $dict[$col.ColumnName] = $null
            } elseif ($val -is [System.DateTime]) {
                $dict[$col.ColumnName] = $val.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            } elseif ($val -is [System.Boolean]) {
                $dict[$col.ColumnName] = [bool]$val
            } elseif ($val -is [System.Byte[]]) {
                $dict[$col.ColumnName] = [System.Convert]::ToBase64String($val)
            } else {
                $dict[$col.ColumnName] = $val
            }
        }
        $rows += $dict
    }
    
    $filePath = Join-Path $OutputDir "$table.json"
    $json = $rows | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($filePath, $json, [System.Text.Encoding]::UTF8)
    Write-Host "Exported $table ($($rows.Count) rows) -> $filePath"
}

$conn.Close()
Write-Host "All tables exported successfully to $OutputDir"
